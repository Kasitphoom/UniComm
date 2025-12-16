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

export enum ExportType {
    PDF = 'pdf',
    XML = 'xml'
}

const ExportButton = ({ onPress, types }: { 
    types: ExportType[]
    onPress?: (key: React.Key) => void;
}) => {
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
                onAction={onPress}
                variant="flat"
                color="secondary"
            >
                {types.includes(ExportType.PDF) ? (
                    <DropdownItem
                        key="pdf"
                        startContent={<FileText size={18} />}
                        description="Download a PDF preview of the document"
                    >
                        PDF Preview
                    </DropdownItem>
                ) : null}
                {types.includes(ExportType.XML) ? (
                    <DropdownItem
                        key="xml"
                        startContent={<FileCode size={18} />}
                        description="Export data structure to XML"
                    >
                        XML Data
                    </DropdownItem>
                ) : null}
            </DropdownMenu>
        </Dropdown>
    )
}

export default ExportButton