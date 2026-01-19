'use client'
import React, { useState, useEffect } from 'react'
import ExportBar from '../Editor/ExportBar'
import { getStorageService } from '@/utils/upload/modules'
import { TemplateWithUser } from '@/types/template'
import { addToast, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, useDisclosure, Spinner, Tabs, Tab } from '@heroui/react'
import { useAppSelector } from '@/store/hooks'
import { generate } from '@pdfme/generator'
import { plugins } from '../Editor/plugins'
import { Template, getInputFromTemplate } from '@pdfme/common'
import { clientFetchParsedTemplate, clientFetchTemplate } from '@/utils/template/utils'
import dynamic from 'next/dynamic'

const PdfViewer = dynamic(() => import('@/components/PdfViewer'), { 
    ssr: false,
    loading: () => <div className='w-full h-full flex justify-center items-center'><Spinner color='secondary'/></div>, 
})

// Extract actual content from a schema entry for mock input generation
const getContentFromSchema = (schema: any): string => {
    if (!schema) return ''
    if (schema.content !== undefined && schema.content !== null) {
        return String(schema.content)
    }
    return ''
}

// Shared PDF preview generator that produces a Uint8Array for a template
export const generatePdfPreview = async (template: Template) => {
    const mockInputs = getInputFromTemplate(template).map((obj, pageIndex) => {
        const mockInput: Record<string, string> = {}
        const pageSchemas = template.schemas[pageIndex] || []

        for (const key of Object.keys(obj)) {
            const schema = pageSchemas.find((s: any) => s.name === key)
            mockInput[key] = schema ? getContentFromSchema(schema) : ''
        }
        return mockInput
    })

    const pdfBytes = await generate({
        template,
        inputs: mockInputs,
        plugins,
    })

    return pdfBytes
}

const TemplateExportBar = ({ id, isOwner }: { id: string, isOwner: boolean }) => {
    const { isOpen, onOpen, onOpenChange } = useDisclosure()
    const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)
    const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
    const [selectedMode, setSelectedMode] = useState<string | number>('browser')
    const [isMobile, setIsMobile] = useState(false)
    const parsedTemplate = useAppSelector(state => state.templates.parsedTemplate)

    useEffect(() => {
        // Detect mobile screen size
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768) // md breakpoint
        }

        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Export Handler
    const handleExport = async (key: React.Key) => {
        switch (key) {
            case 'pdf':
                await exportPDF()
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

        const template = await clientFetchTemplate(id)
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

    const exportPDF = async () => {
        try {

            const templateData = await clientFetchTemplate(id)
            const template = await clientFetchParsedTemplate(id)

            // Generate PDF as Uint8Array
            const pdfBytes = await generatePdfPreview(template)

            // Convert to blob and create object URL
            const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = `${templateData.title || 'document'}.pdf`
            link.click()
            link.remove()

            addToast({
                title: 'PDF Ready',
                description: 'Your PDF download should begin shortly.',
            })
        } catch (error: any) {
            addToast({
                title: 'PDF Download Error',
                description: `Failed to generate PDF: ${error.message || error}`,
                color: 'danger',
            })
            console.error('Preview generation error:', error)
        }
    }

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
            setPreviewTemplate(template)

            // Generate PDF as Uint8Array
            const pdfBytes = await generatePdfPreview(template)

            // Convert to blob and create object URL
            const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
            const url = URL.createObjectURL(blob)
            setPreviewPdfUrl(url)
            onOpen()

            addToast({
                title: 'Preview Ready',
                description: 'Press [Esc] or the close button to exit preview.',
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
                approvalButtonConfig={{ disabled: !isOwner }}
                onExportButtonClick={handleExport}
                onPreviewButtonClick={handlePreview}
            />

            {/* PDF Preview Modal */}
            <Modal
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                size="full"
            >
                <ModalContent className="flex flex-col h-full">
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex justify-between items-center">
                                <span>PDF Preview</span>
                            </ModalHeader>
                            
                            <ModalBody className="flex-1 overflow-hidden p-0 gap-0">
                                {!isMobile && (
                                    <div className="w-full border-b px-4 py-2 flex justify-center">
                                        <Tabs selectedKey={selectedMode} onSelectionChange={setSelectedMode}>
                                            <Tab key="browser" title="Browser Viewer"></Tab>
                                            <Tab key="system" title="System Viewer"></Tab>
                                        </Tabs>
                                    </div>
                                )}
                                {isGeneratingPreview ? (
                                    <div className="flex items-center justify-center h-96">
                                        <Spinner label="Generating preview..." />
                                    </div>
                                ) : previewTemplate ? (
                                    isMobile || selectedMode === 'system' ? (
                                        <PdfViewer 
                                            template={previewTemplate} 
                                            className="w-full h-full"
                                            options={{ zoomLevel: 1.0 }}
                                        />
                                    ) : (
                                        <iframe
                                            src={previewPdfUrl || ""}
                                            className="w-full h-full border-0"
                                            title="PDF Preview"
                                        />
                                    )
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