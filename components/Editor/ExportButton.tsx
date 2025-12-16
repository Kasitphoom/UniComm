'use client'
import React from 'react'
import {
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
    Button
} from '@heroui/react'
import {
    Download,
    FileText,
    FileCode,
    ChevronDown
} from 'lucide-react'

const ExportButton = () => {
    // Mock handler for export actions
    const handleExport = (key: React.Key) => {
        console.log(`Exporting to ${key}...`)
        // Add your export logic here
    }

    return (
        <Dropdown placement="bottom-end">
            <DropdownTrigger>
                <Button
                    color="secondary"
                    variant="flat" // Matches the group style
                    startContent={<Download size={18} />}
                    endContent={<ChevronDown size={14} className="text-secondary-500" />}
                >
                    Export
                </Button>
            </DropdownTrigger>
            <DropdownMenu
                aria-label="Export Options"
                onAction={handleExport}
                variant="flat"
                color="secondary"
            >
                <DropdownItem
                    key="pdf"
                    startContent={<FileText size={18} />}
                    description="Download a PDF preview of the document"
                >
                    PDF Preview
                </DropdownItem>
                <DropdownItem
                    key="xml"
                    startContent={<FileCode size={18} />}
                    description="Export data structure to XML"
                >
                    XML Data
                </DropdownItem>
            </DropdownMenu>
        </Dropdown>
    )
}

export default ExportButton