'use client'
import React, { useState } from 'react'
import ExportBar from '../Editor/ExportBar'
import { getStorageService } from '@/utils/upload/modules'
import { TemplateWithUser } from '@/types/template'
import { addToast, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, useDisclosure, Spinner } from '@heroui/react'
import { useAppSelector } from '@/store/hooks'
import { generate } from '@pdfme/generator'
import { plugins } from '../Editor/plugins'
import { Template, getInputFromTemplate } from '@pdfme/common'
import { X } from 'lucide-react'

const TemplateExportBar = ({ id }: { id: string }) => {
    const { isOpen, onOpen, onOpenChange } = useDisclosure()
    const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
    const parsedTemplate = useAppSelector(state => state.templates.parsedTemplate)

    // Export Handler
    const handleExport = async (key: React.Key) => {
        switch (key) {
            case 'pdf':
                console.log('Exporting template as PDF...')
                // Add your PDF export logic here
                break
            case 'xml':
                await exportXML()
                break
            default:
                console.warn(`Unknown export type: ${key}`)
        }
    }

    const exportXML = async () => {
        const storage = getStorageService()
        if (!storage) {
            addToast({
                title: 'Export Error',
                description: 'Storage service not configured',
                color: 'danger',
            })
            return
        }

        const result = await fetch(`/api/templates/${id}`, 
            {
                credentials: 'include'
            }
        )
        if (!result.ok) {
            addToast({
                title: 'Export Error',
                description: `Failed to fetch template data: ${result.statusText}`,
                color: 'danger',
            })
            return
        }
        const template = (await result.json()) as TemplateWithUser
        const filePath = template.filePath
        if (!filePath) {
            addToast({
                title: 'Export Error',
                description: 'Template file path is missing',
                color: 'danger',
            })
            return
        }

        const downloadFile = async () => {
            const xmlContent = await storage.getFileContent(filePath)
            if (typeof window === 'undefined') {
                return xmlContent
            }

            const fileName = template.title ? `${template.title}.xml` : "template.xml"
            const blob = new Blob([xmlContent], { type: 'application/xml; charset=utf-8' })
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = fileName
            link.click()
            link.remove()
        }

        try {
            const downloadPromise = downloadFile()
            addToast({
                title: 'Exporting XML',
                description: 'Your XML export is being prepared.',
                promise: downloadPromise,
            })
        }
        catch (error: any) {
            addToast({
                title: 'Export Error',
                description: `Failed to export XML: ${error.message || error}`,
                color: 'danger',
            })
            throw error
        }
    }

    // Extract actual content from schema
    const getContentFromSchema = (schema: any): string => {
        if (!schema) return '';
        // If schema has content property, use it directly
        if (schema.content !== undefined && schema.content !== null) {
            return String(schema.content);
        }
        return '';
    };

    // Handle preview
    const handlePreview = async () => {
        setIsGeneratingPreview(true)
        try {
            if (!parsedTemplate?.data) {
                addToast({
                    title: 'Preview Error',
                    description: 'Parsed template data is not available for preview',
                    color: 'danger',
                })
                return
            }

            const template = parsedTemplate.data as Template
            
            // Generate inputs from template schema using actual content
            const mockInputs = getInputFromTemplate(template).map((obj, pageIndex) => {
                const mockInput: Record<string, string> = {}
                const pageSchemas = template.schemas[pageIndex] || []
                
                for (const key of Object.keys(obj)) {
                    // Find the matching schema for this key
                    const schema = pageSchemas.find((s: any) => s.name === key)
                    mockInput[key] = schema ? getContentFromSchema(schema) : ''
                }
                return mockInput
            })

            // Generate PDF as Uint8Array
            const pdfBytes = await generate({
                template,
                inputs: mockInputs,
                plugins
            })

            // Convert to blob and create object URL
            const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
            const url = URL.createObjectURL(blob)
            window.open(url, '_blank')
            // setPreviewPdfUrl(url)
            // onOpen()

            addToast({
                title: 'Preview Ready',
                description: 'PDF preview generated successfully',
                color: 'success',
            })
        } catch (error: any) {
            addToast({
                title: 'Preview Error',
                description: `Failed to generate preview: ${error.message || error}`,
                color: 'danger',
            })
            console.error('Preview generation error:', error)
        } finally {
            setIsGeneratingPreview(false)
        }
    }

    return (
        <>
            <ExportBar
                previewable
                exportable
                requireApproval
                onExportButtonClick={handleExport}
                onPreviewButtonClick={handlePreview}
            />

            {/* PDF Preview Modal */}
            <Modal
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                size="5xl"
                backdrop="blur"
                classNames={{
                    base: "max-h-[95vh]",
                    closeButton: "hidden"
                }}
            >
                <ModalContent className="flex flex-col h-full">
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex justify-between items-center">
                                <span>PDF Preview</span>
                                <Button
                                    isIconOnly
                                    variant="light"
                                    size="sm"
                                    onPress={onClose}
                                >
                                    <X size={20} />
                                </Button>
                            </ModalHeader>
                            
                            <ModalBody className="flex-1 overflow-hidden p-0">
                                {isGeneratingPreview ? (
                                    <div className="flex items-center justify-center h-96">
                                        <Spinner label="Generating preview..." />
                                    </div>
                                ) : previewPdfUrl ? (
                                    <iframe
                                        src={previewPdfUrl}
                                        className="w-full h-full border-0"
                                        title="PDF Preview"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-96 text-default-400">
                                        No PDF loaded
                                    </div>
                                )}
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </>
    )
}

export default TemplateExportBar