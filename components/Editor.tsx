'use client'

import React, { useCallback, useEffect, useRef } from 'react'
import { Designer } from '@pdfme/ui'
import type { Template } from '@pdfme/common'
import { text, image, multiVariableText } from '@pdfme/schemas'
import { Spinner } from '@heroui/react'
import { usePathname } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
    getParsedTemplateSchema,
    resetParsedSchema,
    updateTemplate,
} from '@/features/templates/templatesSlice'

type EditorProps = {
    type: 'pdf' | 'email'
    id: string
}

const Editor: React.FC<EditorProps> = ({ type, id }) => {
    const dispatch = useAppDispatch()
    const pathname = usePathname()

    const { status, data: templateData, error } = useAppSelector(
        (s) => s.templates.parsedTemplate
    )

    const containerRef = useRef<HTMLDivElement>(null)
    const designerRef = useRef<Designer | null>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const latestTemplateRef = useRef<Template | null>(null)

    // Guard flags (refs so they’re always current inside handlers)
    const dirtyRef = useRef(false)
    const savingRef = useRef(false)

    const markDirty = () => {
        dirtyRef.current = true
    }
    const markClean = () => {
        dirtyRef.current = false
    }
    const setSaving = (v: boolean) => {
        savingRef.current = v
    }

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

    const fetchFresh = useCallback(() => {
        dispatch(resetParsedSchema())
        dispatch(getParsedTemplateSchema(id))
        // entering page with fresh data => clean state
        markClean()
        setSaving(false)
    }, [dispatch, id])

    // Debounced push of template updates to the store/API
    const handleDesignerChange = useCallback(
        (updated: Template) => {
            latestTemplateRef.current = updated
            markDirty()

            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
                const payload = latestTemplateRef.current
                if (!payload) return
                setSaving(true)
                // If your slice uses RTK Thunk, you can unwrap(). If not, keep the then/catch.
                const action = dispatch(updateTemplate({ id, templateData: payload }))
                
                Promise.resolve(action?.unwrap?.() ?? action)
                    .then(() => {
                        // saved successfully
                        markClean()
                    })
                    .catch((e: any) => {
                        console.warn('Save failed (keeping dirty):', e)
                        // keep dirty = true
                    })
                    .finally(() => {
                        setSaving(false)
                    })
            }, 2000)
        },
        [dispatch, id]
    )

    useEffect(() => {
        fetchFresh()
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            safeDestroy()
            dispatch(resetParsedSchema())
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

        if (designerRef.current) {
            designerRef.current.updateTemplate(templateData)
        }
    }, [status, templateData, handleDesignerChange])

    // -------- Navigation Guards (close/reload, link clicks, back/forward) --------
    useEffect(() => {
        const shouldBlock = () => dirtyRef.current || savingRef.current

        // 1) Block tab close / hard reload
        const beforeUnload = (e: BeforeUnloadEvent) => {
            if (!shouldBlock()) return
            e.preventDefault()
            // Some browsers need returnValue set
            e.returnValue = ''
        }

        // 2) Block internal navigations via link clicks
        const onDocumentClick = (e: MouseEvent) => {
            if (!shouldBlock()) return

            // We only care about unmodified left-clicks
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
                return
            }

            const anchor = (e.target as HTMLElement)?.closest?.('a[href]') as HTMLAnchorElement | null
            if (!anchor) return

            const href = anchor.getAttribute('href')
            if (!href || href.startsWith('#')) return

            const isSameOrigin =
                anchor.origin === window.location.origin || href.startsWith('/') || href.startsWith('?')

            if (!isSameOrigin) {
                // External link – also confirm
                const ok = window.confirm('You have unsaved changes. Leave this page?')
                if (!ok) {
                    e.preventDefault()
                    e.stopPropagation()
                }
                return
            }

            // Same-origin navigation (likely Next.js Link)
            const ok = window.confirm('You have unsaved changes. Leave this page?')
            if (!ok) {
                e.preventDefault()
                e.stopPropagation()
            }
        }

        // 3) Block back/forward
        const onPopState = (e: PopStateEvent) => {
            if (!shouldBlock()) return
            const ok = window.confirm('You have unsaved changes. Leave this page?')
            if (!ok) {
                // Cancel navigation by pushing current URL back
                history.pushState(null, '', window.location.href)
            }
        }

        window.addEventListener('beforeunload', beforeUnload)
        document.addEventListener('click', onDocumentClick, true) // capture phase to beat Next Link
        window.addEventListener('popstate', onPopState)

        return () => {
            window.removeEventListener('beforeunload', beforeUnload)
            document.removeEventListener('click', onDocumentClick, true)
            window.removeEventListener('popstate', onPopState)
        }
    }, [])

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
