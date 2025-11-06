'use client'
import React, { useEffect, useRef } from 'react'
import { Template, BLANK_A4_PDF, CUSTOM_A4_PDF } from '@pdfme/common';
import { Designer } from '@pdfme/ui';
import { TemplateWithUser } from '@/types/template';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { Spinner } from '@heroui/react';
import { getParsedTemplateSchema } from '@/features/templates/templatesSlice';

const Editor = ({ type, id, data }: { type: "pdf" | "email", id: string, data: TemplateWithUser | null }) => {
    const dispatch = useAppDispatch()
    const parsedTemplateState = useAppSelector(state => state.templates.parsedTemplate)
    const editorRef = useRef<HTMLDivElement>(null)
    const desginerRef = useRef<Designer | null>(null)

    const initiateEditor = () => {
        dispatch(getParsedTemplateSchema(id))
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
                }
            })
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

    return (
        <div className='h-full flex items-center justify-center' ref={editorRef}>
            <Spinner size="lg" color='secondary'> Initialising data... </Spinner>
        </div>
    )
}

export default Editor