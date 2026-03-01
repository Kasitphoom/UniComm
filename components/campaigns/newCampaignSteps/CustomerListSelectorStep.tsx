"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { Select, SelectItem, Card, CardBody, Chip } from '@heroui/react'
import { Users, FileText, CheckCircle2, AlertTriangle, Link2, Database } from 'lucide-react'
import { useAppSelector } from '@/store/hooks'
import { clientFetchTemplate, clientRefreshTemplateDependencies } from '@/utils/template/utils'
import { TemplateWithUser } from '@/types/template'
import type { Selection } from '@react-types/shared'
import TemplateSelectionCard from './TemplateSelectionCard'

interface Props {
    templateId: string | null
    selectedCustomerListId: string | null
    onCustomerListChange: (listId: string | null) => void
    onCompatibilityChange: (isCompatible: boolean | null) => void
}

const isListField = (value: unknown): value is { field: string; type: string } => {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as any).field === 'string' &&
        typeof (value as any).type === 'string'
    )
}

const normalizeFieldName = (value: string) => value.trim().toLowerCase()

const extractRequiredFieldName = (value: unknown): string | null => {
    if (typeof value === 'string') return value
    if (typeof value === 'object' && value !== null) {
        const candidate = value as Record<string, unknown>
        if (typeof candidate.field === 'string') return candidate.field
        if (typeof candidate.name === 'string') return candidate.name
    }
    return null
}

const getRequiredFieldNames = (fields: unknown): string[] => {
    if (!Array.isArray(fields)) return []
    return fields
        .map(extractRequiredFieldName)
        .filter((field): field is string => Boolean(field))
        .map(normalizeFieldName)
}

export const CustomerListSelectorStep = ({
    templateId,
    selectedCustomerListId,
    onCustomerListChange,
    onCompatibilityChange,
}: Props) => {
    const [isCompatible, setIsCompatible] = useState<boolean | null>(null)
    const { items: customerLists, status, error } = useAppSelector((state) => state.customerLists.list)
    const [template, setTemplate] = useState<TemplateWithUser | null>(null)
    const [isTemplateLoading, setIsTemplateLoading] = useState(false)
    const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set([]))

    const evaluateCompatibility = useCallback((customerListId: string | null) => {
        if (!template || !customerListId) {
            setIsCompatible(null)
            onCompatibilityChange(null)
            return
        }

        const selectedList = customerLists.find((list) => list.id === customerListId)
        const listFields = Array.isArray(selectedList?.fields)
            ? selectedList.fields.filter(isListField).map((field) => normalizeFieldName(field.field))
            : []
        const requiredFieldNames = getRequiredFieldNames(template.requiredFields)

        const compatibilityResult = Boolean(
            selectedList && requiredFieldNames.every((field) => listFields.includes(field))
        )

        setIsCompatible(compatibilityResult)
        onCompatibilityChange(compatibilityResult)
    }, [customerLists, onCompatibilityChange, template])

    const handleSelection = useCallback((keys: Selection) => {
        if (keys === 'all') return

        setSelectedKeys(keys)
        const id = Array.from(keys)[0] as string | undefined
        const normalizedId = id ?? null
        onCustomerListChange(normalizedId)

        evaluateCompatibility(normalizedId)
    }, [evaluateCompatibility, onCustomerListChange])

    const fetchTemplateDetails = async (id: string) => {
        setIsTemplateLoading(true)
        try {
            await clientRefreshTemplateDependencies(id)
            const result = await clientFetchTemplate(id)
            setTemplate(result)
        } catch {
            setTemplate(null)
        } finally {
            setIsTemplateLoading(false)
        }
    }

    useEffect(() => {
        if (!templateId) {
            setTemplate(null)
            setSelectedKeys(new Set([]))
            setIsCompatible(null)
            onCompatibilityChange(null)
            return
        }
        fetchTemplateDetails(templateId)
    }, [templateId, onCompatibilityChange])

    useEffect(() => {
        if (template?.contactListId) {
            handleSelection(new Set([template.contactListId]))
        }
    }, [handleSelection, template?.contactListId])

    useEffect(() => {
        if (selectedCustomerListId) {
            setSelectedKeys(new Set([selectedCustomerListId]))
        } else {
            setSelectedKeys(new Set([]))
            setIsCompatible(null)
        }
    }, [selectedCustomerListId])

    useEffect(() => {
        if (!selectedCustomerListId) {
            setIsCompatible(null)
            onCompatibilityChange(null)
            return
        }

        evaluateCompatibility(selectedCustomerListId)
    }, [customerLists, evaluateCompatibility, onCompatibilityChange, selectedCustomerListId, template])

    const TemplateCardSkeleton = () => (
        <div className="relative flex flex-col rounded-xl border-2 border-default-100 bg-white overflow-hidden">
            <div className="aspect-video w-full bg-default-100 animate-pulse" />
            <div className="p-3 space-y-2">
                <div className="h-3 w-3/4 bg-default-200 rounded animate-pulse" />
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-default-200 animate-pulse" />
                    <div className="h-2 w-1/2 bg-default-200 rounded animate-pulse" />
                </div>
            </div>
        </div>
    )

    return (
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-0 py-8 md:py-12 px-4 overflow-x-hidden md:overflow-x-auto">
            
            <div className="w-full md:w-72 relative flex flex-col md:flex-row items-center">
                <div className={`w-full md:w-72 p-1 rounded-2xl border-2 transition-all duration-300 shadow-sm ${selectedCustomerListId ? 'border-secondary bg-secondary/5' : 'border-default-200 bg-content1'}`}>
                    <div className="w-full md:w-auto p-4 bg-content1 rounded-xl">
                        <div className="flex items-center gap-2 mb-3 text-default-500">
                            <Database size={16} />
                            <span className="text-[10px] uppercase font-bold tracking-widest">Input Source</span>
                        </div>
                        <Select
                            label="Customer List"
                            variant="flat"
                            size="sm"
                            selectedKeys={selectedKeys}
                            onSelectionChange={handleSelection}
                            startContent={<Users size={14} />}
                        >
                            {customerLists.map((list: any) => (
                                <SelectItem key={list.id} textValue={list.name}>
                                    {list.name}
                                </SelectItem>
                            ))}
                        </Select>
                    </div>
                </div>

                <div className="absolute 
                    left-1/2 -translate-x-1/2 -bottom-1.25 
                    md:left-auto md:translate-x-0 md:-right-1.25
                    md:top-1/2 md:-translate-y-1/2 md:bottom-auto 
                    z-20">
                    <div className={`w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm transition-colors duration-300 ${selectedCustomerListId ? 'bg-secondary' : 'bg-default-300'}`} />
                </div>
            </div>

            <div className="w-0.5 md:w-12 h-8 md:h-0.5 bg-default-200 relative self-center">
                <div 
                    className={`absolute inset-0 transition-all duration-500 ease-in-out
                    ${selectedCustomerListId ? 'bg-secondary w-full h-full' : 'w-0 h-0'}`} 
                />
            </div>

            <div className="relative group">
                <div className={`z-20 relative px-6 py-3 rounded-full border-2 bg-white shadow-lg flex items-center gap-3 transition-all
                    ${!selectedCustomerListId ? 'border-dashed border-default-300 opacity-50' : isCompatible ? 'border-secondary' : 'border-danger animate-pulse'}`}>
                    
                    {isCompatible === null ? (
                        <div className="flex items-center gap-2 text-default-400">
                            <div className="w-2 h-2 rounded-full bg-default-300 animate-pulse" />
                            <span className="text-xs font-medium">Waiting...</span>
                        </div>
                    ) : isCompatible ? (
                        <div className="flex items-center gap-2 text-secondary font-bold">
                            <CheckCircle2 size={18} />
                            <span className="text-xs uppercase">Validated</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-danger font-bold">
                            <AlertTriangle size={18} />
                            <span className="text-xs uppercase">Mismatch</span>
                        </div>
                    )}
                </div>
                {selectedCustomerListId && isCompatible && (
                    <div className="absolute inset-0 bg-secondary/20 blur-xl rounded-full -z-10" />
                )}
            </div>

            <div className="w-0.5 md:w-16 h-8 md:h-0.5 bg-default-200 relative">
                 <div className={`absolute inset-0 transition-all duration-500 ${isCompatible ? 'bg-secondary w-full h-full' : 'w-0 h-0'}`} />
            </div>

            <div className="relative flex flex-col items-center w-full md:w-auto">
                 <div className="absolute 
                    left-1/2 -translate-x-1/2 -top-1.25 md:top-1/2 
                    md:-left-1 md:-translate-y-1/2 md:translate-x-0 
                    w-3 h-3 rounded-full bg-default-300 border-2 border-white z-10" />
                 
                 <div className="w-full md:w-72">
                    {isTemplateLoading ? (
                        <TemplateCardSkeleton />
                    ) : template ? (
                        <div className={`transition-all duration-500 transform ${isCompatible ? 'scale-100 opacity-100' : 'scale-95 opacity-70 grayscale'}`}>
                             <TemplateSelectionCard template={template} isSelected={false} onToggle={() => {}} />
                        </div>
                    ) : (
                        <Card className="border-dashed border-2 border-default-200 bg-default-50/50">
                            <CardBody className="flex flex-col items-center py-6">
                                <FileText size={20} className="text-default-300 mb-2" />
                                <span className="text-[10px] text-default-400 text-center uppercase tracking-tighter">Target Template</span>
                            </CardBody>
                        </Card>
                    )}
                 </div>
            </div>
        </div>
    )
}
