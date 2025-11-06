'use client'
import React, { useEffect, useRef } from 'react'
import { Template, BLANK_A4_PDF } from '@pdfme/common';
import { Designer } from '@pdfme/ui';

const Editor = ({ type, id }: { type: "pdf" | "email", id: string }) => {
    const editorRef = useRef<HTMLDivElement>(null)

    const initiateEditor = () => {
        if (editorRef.current === null) return

        const template: Template = {
            basePdf: BLANK_A4_PDF,
            schemas: [[]],
        }

        const desginer = new Designer({
            domContainer: editorRef.current,
            template,
            options: {
                zoomLevel: 1,
                theme: {
                    token: {
                        colorPrimary: '#7828c8',
                    }
                }
            }
        })
    }

    useEffect(() => {
        if (!editorRef.current) return
        initiateEditor()
    }, [editorRef])

    return (
        <div className='h-full' ref={editorRef}></div>
    )
}

export default Editor