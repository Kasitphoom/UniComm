'use client'

import React, { useCallback, useEffect, useRef } from 'react'
import { Designer } from '@pdfme/ui'
import type { Template } from '@pdfme/common'
import { text, image, multiVariableText } from '@pdfme/schemas'
import { Spinner } from '@heroui/react'
import { usePathname, useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
    getParsedTemplateSchema,
    resetParsedSchema,
    updateTemplate,
} from '@/features/templates/templatesSlice'
import { saveTemplateDraft, loadTemplateDraft, clearTemplateDraft, hashTemplate } from '@/lib/draftStore'
import { TemplateWithUser } from '@/types/template'

type EditorProps = {
    type: 'pdf' | 'email'
    id: string
}

const Editor: React.FC<EditorProps> = ({ type, id }) => {
    const dispatch = useAppDispatch()
    const pathname = usePathname()
    const router = useRouter()

    const { status, data: templateData, error } = useAppSelector(
        (s) => s.templates.parsedTemplate
    )

    const containerRef = useRef<HTMLDivElement>(null)
    const designerRef = useRef<Designer | null>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const latestTemplateRef = useRef<Template | null>(null)
    const lastDraftTplRef = useRef<Template | null>(null)
    const lastUploadedHashRef = useRef<string | null>(null)
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isFlushingRef = useRef<boolean>(false)

    const safeDestroy = useCallback(() => {
        if (designerRef.current) {
            try {
                designerRef.current.destroy()
            } catch (e) {
                console.warn('Designer destroy error (ignored):', e)
            } finally {
                designerRef.current = null
            }
        }
    }, [])

    const flushToCloud = useCallback(async () => {
        const tpl = lastDraftTplRef.current ?? (await loadTemplateDraft(id))
        if (!tpl) return

        const tplHash = await hashTemplate(tpl)
        if (tplHash === lastUploadedHashRef.current) return // unchanged → skip

        try {
            const action = await dispatch(updateTemplate({ id, templateData: tpl }))
            // unwrap if you use RTK  - optional:
            // const payload = await (action as any).unwrap?.()
            const hash = (action.payload as TemplateWithUser).versions?.[0]?.version 
            lastUploadedHashRef.current = hash ?? tplHash
        } catch (e) {
            console.warn('Checkpoint error:', e)
        }
    }, [dispatch, id])

    const scheduleIdleUpload = useCallback(() => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
        idleTimerRef.current = setTimeout(() => { void flushToCloud() }, 20 * 60 * 1000) // 20 minutes
    }, [flushToCloud])

    const fetchFresh = useCallback(() => {
        dispatch(resetParsedSchema())
        dispatch(getParsedTemplateSchema(id))
    }, [dispatch, id])

    // Debounced push of template updates to the store/API
    const handleDesignerChange = useCallback(
        async (updated: Template) => {
            latestTemplateRef.current = updated
            latestTemplateRef.current = updated
            lastDraftTplRef.current = updated
            await saveTemplateDraft(id, updated) // fast local autosave
            scheduleIdleUpload()
        },
        [dispatch, id]
    )

    useEffect(() => {
        fetchFresh()
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            safeDestroy()
            dispatch(resetParsedSchema())
            // Attempt a final flush on unmount
            void flushToCloud()
        }
    }, [fetchFresh, dispatch, safeDestroy, pathname])

    useEffect(() => {
        if (!templateData || status !== 'succeeded') return

        if (!designerRef.current && containerRef.current) {
            designerRef.current = new Designer({
                domContainer: containerRef.current,
                template: templateData,
                options: {
                    zoomLevel: 1,
                    theme: { token: { colorPrimary: '#7828c8' } },
                },
                plugins: { text, image, multiVariableText },
            })
            designerRef.current.onChangeTemplate(handleDesignerChange)
            return
        }

        const updateTemplate = async () => {
            if (designerRef.current) {
                const templateDraft = await loadTemplateDraft(id)
                designerRef.current.updateTemplate(templateData ?? templateDraft)
            }
        }

        updateTemplate()
    }, [status, templateData, handleDesignerChange])

    // -------- Navigation Guards (close/reload, link clicks, back/forward) --------
    useEffect(() => {
        const onPageHide = async () => {
            const tpl = lastDraftTplRef.current ?? (await loadTemplateDraft(id))
            if (!tpl) return
            const tplHash = await hashTemplate(tpl)
            if (tplHash === lastUploadedHashRef.current) return
            await flushToCloud()
        }
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') {
                void flushToCloud()
            }
        }
        window.addEventListener('pagehide', onPageHide)
        window.addEventListener('beforeunload', onPageHide)
        window.addEventListener('popstate', onPageHide) // back/forward
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
            window.removeEventListener('pagehide', onPageHide)
            window.removeEventListener('beforeunload', onPageHide)
            window.removeEventListener('popstate', onPageHide)
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [flushToCloud, id])

    // Intercept internal link clicks to flush before navigating
    useEffect(() => {
        const clickHandler = async (e: MouseEvent) => {
            const target = e.target as Element | null
            if (!target) return
            const a = target.closest('a') as HTMLAnchorElement | null
            if (!a) return
            if (a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
            const href = a.getAttribute('href')
            if (!href) return
            const url = new URL(href, window.location.href)
            if (url.origin !== window.location.origin) return

            // Same-page hash changes don't need flushing
            const nextPath = url.pathname + url.search
            const currPath = window.location.pathname + window.location.search
            if (nextPath === currPath) return

            e.preventDefault()
            if (isFlushingRef.current) return
            isFlushingRef.current = true
            try {
                await flushToCloud()
            } catch (err) {
                console.warn('Flush before navigate failed:', err)
            } finally {
                isFlushingRef.current = false
            }
            router.push(url.pathname + url.search + url.hash)
        }
        document.addEventListener('click', clickHandler, true)
        return () => document.removeEventListener('click', clickHandler, true)
    }, [flushToCloud, router])

    const isLoading = status === 'idle' || status === 'loading'
    const hasError = status === 'failed'

    return (
        <div className="relative h-full w-full min-w-0 overflow-hidden">
            <div
                ref={containerRef}
                className="relative h-full w-full min-w-0 overflow-hidden flex items-center justify-center"
            >
                {isLoading && (
                    <Spinner size="lg" color="secondary">
                        Initialising data...
                    </Spinner>
                )}
                {hasError && (
                    <div className="text-sm text-danger-500">
                        Failed to load template: {String(error ?? 'Unknown error')}
                    </div>
                )}
            </div>
        </div>
    )
}

export default Editor
