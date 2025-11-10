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
        // Wipe any previous state and fetch fresh for this id
        dispatch(resetParsedSchema())
        dispatch(getParsedTemplateSchema(id))
    }, [dispatch, id])

    // Debounced push of template updates to the store/API
    const handleDesignerChange = useCallback(
        (updated: Template) => {
            latestTemplateRef.current = updated
            console.log(updated)
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
                const payload = latestTemplateRef.current
                if (payload) {
                    dispatch(updateTemplate({ id, templateData: payload }))
                }
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

        // Create Designer once for the current load
        if (!designerRef.current && containerRef.current) {
            designerRef.current = new Designer({
                domContainer: containerRef.current,
                template: templateData,
                options: {
                    zoomLevel: 1,
                    theme: { token: { colorPrimary: '#7828c8' } },
                },
                plugins: {
                    text,
                    image,
                    multiVariableText
                },
            })
            designerRef.current.onChangeTemplate(handleDesignerChange)
            return
        }

        // If already created for this mount, just update its template
        if (designerRef.current) {
            designerRef.current.updateTemplate(templateData)
        }
    }, [status, templateData, handleDesignerChange])

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
