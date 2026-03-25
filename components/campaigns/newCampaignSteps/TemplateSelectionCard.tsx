"use client"

import { useEffect, useState } from 'react'
import { Users, CheckCircle2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { TemplateWithUser } from '@/types/template'
import type { Template } from '@pdfme/common'
import { clientFetchParsedTemplate } from '@/utils/template/utils'

const PdfViewer = dynamic(() => import('@/components/PdfViewer'), { ssr: false })

type TemplateSelectionCardProps = {
    template: TemplateWithUser
    isSelected: boolean
    onToggle: () => void
}

const TemplateSelectionCard = ({ template, isSelected, onToggle }: TemplateSelectionCardProps) => {
    const [parsedTemplate, setParsedTemplate] = useState<Template | null>(null)

    useEffect(() => {
        let isMounted = true

        clientFetchParsedTemplate(template.id)
            .then((tpl) => {
                if (isMounted) {
                    setParsedTemplate(tpl)
                }
            })
            .catch((error) => {
                if (isMounted) {
                    console.error('Failed to load template preview', error)
                }
            })

        return () => {
            isMounted = false
        }
    }, [template.id])

    return (
        <div
            onClick={onToggle}
            className={`
                relative flex flex-col rounded-xl border-2 transition-all cursor-pointer group overflow-hidden
                ${isSelected ? 'border-secondary bg-secondary-50/30' : 'border-default-100 bg-white hover:border-default-300'}
            `}
        >
            <div className="aspect-video w-full bg-default-50 border-b border-default-100 relative">
                {parsedTemplate ? (
                    <PdfViewer
                        template={parsedTemplate}
                        className="w-full h-full object-cover"
                        customViewerOptions={{ showToolbar: false, scroll: false }}
                    />
                ) : (
                    <div className="w-full h-full bg-default-100 animate-pulse" />
                )}
                {isSelected && (
                    <div className="absolute inset-0 bg-secondary/10 flex items-center justify-center backdrop-blur-[1px]">
                        <div className="bg-white rounded-full p-1 shadow-lg">
                            <CheckCircle2 className="text-secondary" size={24} />
                        </div>
                    </div>
                )}
            </div>

            <div className="p-3 space-y-2">
                <p className="text-tiny font-bold truncate text-default-800">{template.title}</p>
                <div className="flex items-center gap-1 text-[10px] text-default-400">
                    <Users size={12} />
                    <span className="truncate">{template.contactList?.name || 'No customer list linked'}</span>
                </div>
            </div>
        </div>
    )
}

export default TemplateSelectionCard
