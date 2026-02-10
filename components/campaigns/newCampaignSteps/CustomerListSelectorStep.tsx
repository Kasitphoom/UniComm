"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { Select, SelectItem, Card, CardBody, Chip } from '@heroui/react'
import { Users, FileText, CheckCircle2, AlertTriangle, Link2 } from 'lucide-react'
import { useAppSelector } from '@/store/hooks'
import { clientFetchTemplate } from '@/utils/template/utils'
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

    const handleSelection = useCallback((keys: Selection) => {
        if (keys === 'all') return

        setSelectedKeys(keys)
        const id = Array.from(keys)[0] as string | undefined
        const normalizedId = id ?? null
        onCustomerListChange(normalizedId)

        if (!template || !normalizedId) {
            setIsCompatible(null)
            onCompatibilityChange(null)
            return
        }

        const selectedList = customerLists.find((list) => list.id === normalizedId)
        const listFields = Array.isArray(selectedList?.fields)
            ? selectedList.fields.filter(isListField).map((field) => normalizeFieldName(field.field))
            : []
        const requiredFieldNames = getRequiredFieldNames(template.requiredFields)

        const compatibilityResult = Boolean(
            selectedList && requiredFieldNames.every((field) => listFields.includes(field))
        )

        setIsCompatible(compatibilityResult)
        onCompatibilityChange(compatibilityResult)
    }, [customerLists, onCompatibilityChange, onCustomerListChange, template])

    const fetchTemplateDetails = async (id: string) => {
        setIsTemplateLoading(true)
        const result = await clientFetchTemplate(id)
        setTemplate(result)
        setIsTemplateLoading(false)
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
        <div className="flex flex-col items-center gap-4 py-4 animate-in fade-in duration-500">
            <div className="w-full max-w-md p-6 bg-content1 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Users size={18} />
                    <span className="text-small uppercase tracking-wider">Source Audience</span>
                </div>
                <Select
                    label="Choose Customer List"
                    variant="bordered"
                    color={selectedCustomerListId ? (isCompatible ? 'secondary' : 'danger') : 'default'}
                    onSelectionChange={handleSelection}
                    startContent={<Users size={16} className="text-default-400" />}
                    errorMessage={error}
                    isLoading={status === 'loading'}
                    selectedKeys={selectedKeys}
                >
                    {customerLists.map((list) => (
                        <SelectItem key={list.id} description={list.remarks}>
                            {list.name}
                        </SelectItem>
                    ))}
                </Select>
            </div>

            <div className="relative flex flex-col items-center w-full h-20 justify-center">
                <div
                    className={`w-1 h-full rounded-full transition-all duration-700 
                    ${selectedCustomerListId ? (isCompatible ? 'bg-secondary' : 'bg-danger') : 'bg-default-100'}`}
                />
                <div className="absolute top-1/2 -translate-y-1/2 z-10">
                    {!selectedCustomerListId ? (
                        <div className="bg-white p-2 rounded-full border-2 border-dashed border-default-200 text-default-300">
                            <Link2 size={20} />
                        </div>
                    ) : (
                        <Chip
                            color={isCompatible ? 'secondary' : 'danger'}
                            variant="shadow"
                            startContent={isCompatible ? <CheckCircle2 size={16} /> : <AlertTriangle className="ml-2" size={16} />}
                            className={`border-2 border-white transition-all ${isCompatible ? '' : 'animate-bounce'}`}
                        >
                            {isCompatible ? 'Customer information matched' : 'Mapping Mismatch'}
                        </Chip>
                    )}
                </div>
            </div>

            <div className="w-full max-w-sm">
                {isTemplateLoading && !template ? (
                    <TemplateCardSkeleton />
                ) : template ? (
                    <TemplateSelectionCard template={template} isSelected={false} onToggle={() => {}} />
                ) : (
                    <Card className="border-dashed border-default-200">
                        <CardBody className="flex flex-col items-center gap-4 py-8">
                            <FileText size={24} className="text-default-300" />
                            <span className="text-default-500 text-center">Select a template to preview its details here.</span>
                        </CardBody>
                    </Card>
                )}
            </div>
        </div>
    )
}
