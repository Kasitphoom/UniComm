'use client'
import React from 'react'
import ExportBar from '../Editor/ExportBar'
import { getStorageService } from '@/utils/upload/modules'
import { TemplateWithUser } from '@/types/template'
import { addToast } from '@heroui/react'

const TemplateExportBar = ({ id }: { id: string }) => {

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

    return (
        <ExportBar
            previewable
            exportable
            requireApproval
            onExportButtonClick={handleExport} 
        />
    )
}

export default TemplateExportBar