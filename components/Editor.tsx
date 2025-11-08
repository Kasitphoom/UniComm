'use client'
import React, { useEffect, useRef } from 'react'
import { Template, BLANK_A4_PDF, CUSTOM_A4_PDF } from '@pdfme/common';
import { Designer } from '@pdfme/ui';
import { TemplateWithUser } from '@/types/template';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { Spinner } from '@heroui/react';
import { getParsedTemplateSchema, updateTemplate } from '@/features/templates/templatesSlice';

const Editor = ({ type, id, data }: { type: "pdf" | "email", id: string, data: TemplateWithUser | null }) => {
    const dispatch = useAppDispatch()
    const parsedTemplateState = useAppSelector(state => state.templates.parsedTemplate)
    const editorRef = useRef<HTMLDivElement>(null)
    const desginerRef = useRef<Designer | null>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const latestTemplateRef = useRef<Template | null>(null)

    const initiateEditor = () => {
        dispatch(getParsedTemplateSchema(id))
    }

    const editorChangeCallback = (updatedTemplate: Template) => {
        // Debounce updates: wait 1s after the last change before dispatching
        latestTemplateRef.current = updatedTemplate
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            const payload = latestTemplateRef.current
            if (payload) {
                console.log("Debounced template dispatch:", payload)
                dispatch(updateTemplate({ id, templateData: payload }))
            }
        }, 5000)
    }

    useEffect(() => {

        console.log("Parsed template state changed:", parsedTemplateState)

        if (!parsedTemplateState.data) return

        if (!desginerRef.current && editorRef.current) {
            desginerRef.current = new Designer({
                domContainer: editorRef.current,
                template: parsedTemplateState.data,
                options: {
                    zoomLevel: 1,
                    theme: {
                        token: {
                            colorPrimary: '#7828c8',
                        }
                    }
                },
            })

            desginerRef.current.onChangeTemplate(editorChangeCallback)
            return
        }

        if (desginerRef.current) {
            desginerRef.current.updateTemplate(parsedTemplateState.data)
        }

    }, [parsedTemplateState, desginerRef.current, editorRef.current])

    useEffect(() => {
        console.log("Initializing editor...")
        console.log("Editor ref:", editorRef.current)
        initiateEditor()
    }, [editorRef.current])

    // Cleanup debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [])

    return (
        <div className='relative h-full w-full min-w-0 overflow-hidden flex items-center justify-center' ref={editorRef}>
            <Spinner size="lg" color='secondary'> Initialising data... </Spinner>
        </div>
    )
}

export default Editor