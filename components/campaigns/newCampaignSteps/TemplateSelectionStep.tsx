"use client"

import type { RefObject } from 'react'
import { Input, ScrollShadow, Spinner } from '@heroui/react'
import { Search } from 'lucide-react'
import type { TemplateWithUser } from '@/types/template'
import TemplateSelectionCard from './TemplateSelectionCard'

type TemplateSelectionStepProps = {
    templates: TemplateWithUser[]
    selectedTemplateId: string | null
    searchQuery: string
    onSearchChange: (value: string) => void
    onTemplateToggle: (templateId: string) => void
    scrollerRef: RefObject<HTMLElement | null>
    isLoading: boolean
}

const TemplateSelectionStep = ({
    templates,
    selectedTemplateId,
    searchQuery,
    onSearchChange,
    onTemplateToggle,
    scrollerRef,
    isLoading,
}: TemplateSelectionStepProps) => (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 h-111.5">
        <div className="flex justify-between items-center px-1">
            <p className="text-small font-bold text-default-600">
                Select Template ({selectedTemplateId ? 1 : 0}/1)
            </p>
            <Input
                placeholder="Search templates..."
                size="sm"
                variant="bordered"
                className="max-w-xs"
                startContent={<Search size={14} className="text-default-400" />}
                value={searchQuery}
                onValueChange={onSearchChange}
            />
        </div>

        <ScrollShadow ref={scrollerRef} className="h-112.5 p-1 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                    <TemplateSelectionCard
                        key={template.id}
                        template={template}
                        isSelected={selectedTemplateId === template.id}
                        onToggle={() => onTemplateToggle(template.id)}
                    />
                ))}
            </div>

            {isLoading && (
                <div className="flex justify-center w-full py-6">
                    <Spinner color="secondary" size="sm" label="Loading more templates..." />
                </div>
            )}
        </ScrollShadow>
    </div>
)

export default TemplateSelectionStep
