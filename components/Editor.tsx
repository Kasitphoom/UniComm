'use client'

import React, { useCallback, useEffect, useRef } from 'react'
import { Designer } from '@pdfme/ui'
import type { Template } from '@pdfme/common'
import { plugins } from './Editor/plugins'
import { Spinner } from '@heroui/react'
import { usePathname, useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { saveTemplateDraft, loadTemplateDraft, hashTemplate } from '@/lib/draftStore'
import { TemplateWithUser } from '@/types/template'
import { componentBlockAdapter, EditorAdapter, templateAdapter } from '@/lib/editor/adapter'
import dynamic from 'next/dynamic'

const PdfViewer = dynamic(() => import('@/components/PdfViewer'), { ssr: false })

type EditorProps = {
    contentType?: 'pdf' | 'email'
    id: string
    resource?: 'template' | 'component'
    draftKeyPrefix?: string // namespace for local draft storage (defaults to 'template')
    hasPermission?: boolean // if false, show read-only preview instead of editor
}

/**
 * Editor component for editing templates.
 * @param id Template ID to load and edit
 * @param resource Resource type: 'template' or 'component'
 * @param draftKeyPrefix Prefix for draft storage keys
 * @param hasPermission If false, shows read-only preview instead of editor
 * @returns JSX Element
 */
const Editor: React.FC<EditorProps> = ({ id, resource = 'template', draftKeyPrefix = 'template', hasPermission = true }) => {
    const dispatch = useAppDispatch()
    const pathname = usePathname()
    const router = useRouter()
    const draftId = `${draftKeyPrefix}:${id}`
    const adapter: EditorAdapter = resource === 'template' ? templateAdapter : componentBlockAdapter // map by resource when component adapter exists

    const { status, data: templateData, error } = useAppSelector(adapter.selectParsed)

    const currentTemplateDetail = useAppSelector(adapter.selectDetail)

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
        const tpl = lastDraftTplRef.current ?? (await loadTemplateDraft(draftId))
        if (!tpl) return

        const tplHash = await hashTemplate(tpl)
        if (tplHash === lastUploadedHashRef.current || tplHash === currentTemplateDetail?.versions?.[0].version) return // unchanged → skip

        try {
            const payload = await adapter.updateResource(dispatch, { id, templateData: tpl })
            const hash = payload.versions?.[0]?.version 
            lastUploadedHashRef.current = hash ?? tplHash
        } catch (e) {
            console.warn('Checkpoint error:', e)
        }
    }, [dispatch, id, adapter, currentTemplateDetail, draftId])

    const scheduleIdleUpload = useCallback(() => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
        idleTimerRef.current = setTimeout(() => { void flushToCloud() }, 20 * 60 * 1000) // 20 minutes
    }, [flushToCloud])

    const fetchFresh = useCallback(() => {
        adapter.resetParsed(dispatch)
        adapter.loadParsed(dispatch, id)
    }, [dispatch, id, adapter])

    // Debounced push of template updates to the store/API
    const handleDesignerChange = useCallback(
        async (updated: Template) => {
            latestTemplateRef.current = updated
            lastDraftTplRef.current = updated
            await saveTemplateDraft(draftId, updated) // fast local autosave
            scheduleIdleUpload()
        },
        [draftId, dispatch]
    )

    useEffect(() => {
        fetchFresh()
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            safeDestroy()
            adapter.resetParsed(dispatch)
            // Attempt a final flush on unmount
            void flushToCloud()
        }
    }, [fetchFresh, dispatch, safeDestroy, pathname, adapter])

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
                plugins: plugins,
            })
            designerRef.current.onChangeTemplate(handleDesignerChange)
            return
        }

        const updateTemplate = async () => {
            if (designerRef.current) {
                const templateDraft = await loadTemplateDraft(draftId)
                designerRef.current.updateTemplate(templateData ?? templateDraft)
            }
        }

        updateTemplate()
    }, [status, templateData, handleDesignerChange, draftId])

    // -------- Navigation Guards (close/reload, link clicks, back/forward) --------
    useEffect(() => {
        const onPageHide = async () => {
            const tpl = lastDraftTplRef.current ?? (await loadTemplateDraft(draftId))
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

    useEffect(() => {
        if (!hasPermission) return

        const handleSaveShortcut = (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey)) return
            if (e.key.toLowerCase() !== 's') return
            e.preventDefault()
            void flushToCloud()
        }

        window.addEventListener('keydown', handleSaveShortcut)
        return () => window.removeEventListener('keydown', handleSaveShortcut)
    }, [flushToCloud, hasPermission])

    const isLoading = status === 'idle' || status === 'loading'
    const hasError = status === 'failed'

    // If user doesn't have permission, show read-only preview
    if (!hasPermission && templateData) {
        return (
            <div className="relative flex-1 w-full h-full min-w-0 overflow-hidden">
                <PdfViewer 
                    template={templateData} 
                    className="w-full h-full"
                    options={{ zoomLevel: 1.5 }}
                    customViewerOptions={{ showToolbar: true, scroll: true }}
                />
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            className="relative flex-1 w-full h-full min-w-0 overflow-hidden flex items-center justify-center"
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
    )
}

export default Editor
