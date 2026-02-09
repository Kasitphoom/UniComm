"use client"

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { 
    Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, 
    Button, useDisclosure, Input, ScrollShadow, Checkbox, 
    User, Chip, Divider, Badge,
    Spinner
} from '@heroui/react'
import { PlusIcon, Search, Layout, Users, Calendar, Send, CheckCircle2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import { TemplateListItem } from '@/types/template'
import { clientFetchParsedTemplate } from '@/utils/template/utils'
import { Template } from '@pdfme/common'
import { ContactListDTO } from '@/features/customers/types'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchTemplates } from '@/features/templates/templatesSlice'
import { fetchCustomerLists } from '@/features/customers/customerListsSlice'
import { useInfiniteScroll } from '@heroui/use-infinite-scroll'

// Dynamically import the viewer to keep the modal light
const PdfViewer = dynamic(() => import('@/components/PdfViewer'), { ssr: false })

const TemplateSelectionCard = ({ template, isSelected, onToggle }: {
    template: TemplateListItem,
    isSelected: boolean,
    onToggle: () => void
}) => {
    const [parsedTemplate, setParsedTemplate] = useState<Template | null>(null)

    useEffect(() => {
        let isMounted = true
        setParsedTemplate(null)

        // Fetch the parsed template once the card mounts to avoid passing a Promise to PdfViewer
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

    console.log(template.contactList)

    return (
        <div
            onClick={onToggle}
            className={`
                relative flex flex-col rounded-xl border-2 transition-all cursor-pointer group overflow-hidden
                ${isSelected ? 'border-secondary bg-secondary-50/30' : 'border-default-100 bg-white hover:border-default-300'}
            `}
        >
            {/* Minimalist PDF Preview */}
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

            {/* Template Meta */}
            <div className="p-3 space-y-2">
                <p className="text-tiny font-bold truncate text-default-800">{template.title}</p>

                {/* Linked Audience Display */}
                <div className="flex items-center gap-1 text-[10px] text-default-400">
                    <Users size={12} />
                    <span className="truncate">{template.contactList?.name || 'No customer list linked'}</span>
                </div>
            </div>
        </div>
    )
}

const StepIndicator = ({ 
    current, 
    step, 
    label, 
    onStepClick 
}: {
    current: number,
    step: number,
    label: string,
    onStepClick: (step: number) => void
}) => {
    // Determine if the step is "reachable" (already completed or current)
    const isReachable = step <= current; 

    return (
        <div 
            onClick={() => isReachable && onStepClick(step)}
            className={`
                flex items-center gap-2 transition-all duration-200
                ${isReachable ? 'cursor-pointer group' : 'cursor-not-allowed opacity-50'}
                ${current === step ? 'text-secondary' : 'text-default-400'}
            `}
        >
            <div className={`
                w-6 h-6 rounded-full flex items-center justify-center text-[10px] border-1 transition-colors
                ${current === step 
                    ? 'border-secondary bg-secondary text-white font-bold' 
                    : 'border-default-300 group-hover:border-secondary group-hover:text-secondary'}
            `}>
                {step}
            </div>
            
            <span className={`text-tiny font-bold uppercase tracking-wider ${isReachable && 'group-hover:text-secondary'}`}>
                {label}
            </span>

            {step < 3 && <div className="w-6 h-px bg-default-200 mx-1" />}
        </div>
    )
}

const NewCampaignButton = () => {
    const dispatch = useAppDispatch();
    const { isOpen, onOpen, onOpenChange } = useDisclosure()
    const [step, setStep] = useState(1)
    
    // Pagination & Search State
    const [page, setPage] = useState(1)
    const [searchQuery, setSearchQuery] = useState("")
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
    
    // Selection State
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])
    const [campaignName, setCampaignName] = useState("")

    // Redux State
    const { items: templates, status: templateStatus, totalPages } = useAppSelector((state) => state.templates.list);
    const { status: contactListStatus } = useAppSelector((state) => state.customerLists.list);

    // 1. Search Debounce Logic
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery)
            setPage(1) // Reset to first page on new search
        }, 300)
        return () => clearTimeout(timeoutId)
    }, [searchQuery])

    // 2. Fetch Initial Data
    useEffect(() => {
        if (isOpen) {
            dispatch(fetchTemplates({ query: debouncedSearchQuery, page: 1, perPage: 9 }))
        }
    }, [dispatch, debouncedSearchQuery, isOpen])

    useEffect(() => {
        if (isOpen && contactListStatus === "idle") {
            dispatch(fetchCustomerLists())
        }
    }, [dispatch, contactListStatus, isOpen])

    // 3. Load More Function
    const loadMore = useCallback(() => {
        const hasMore = page < totalPages;
        if (templateStatus === 'loading' || !hasMore) return;

        const nextPage = page + 1;
        setPage(nextPage);
        dispatch(fetchTemplates({ query: debouncedSearchQuery, page: nextPage, perPage: 9 }))
    }, [dispatch, templateStatus, page, totalPages, debouncedSearchQuery]);

    // 4. HeroUI Infinite Scroll Hook
    const [, scrollerRef] = useInfiniteScroll({
        hasMore: page < totalPages,
        isEnabled: isOpen && step === 2,
        shouldUseLoader: false, 
        onLoadMore: loadMore,
    });

    const onStepClick = (newStep: number) => {
        if (newStep < step || (step === 1 && campaignName.trim() !== "") || (step === 2 && selectedTemplateIds.length > 0)) {
            setStep(newStep)
        }
    }

    return (
        <>
            <Button 
                color='secondary' 
                onPress={onOpen} 
                startContent={<PlusIcon size={16} />} 
            >
                Create Campaign
            </Button>

            <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="4xl" scrollBehavior="inside" backdrop="blur">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1 border-b border-default-100">
                                <div className="flex items-center gap-2">
                                    <Send size={18} />
                                    <span className="font-bold">Campaign Automation Wizard</span>
                                </div>
                                <div className="flex gap-4 mt-2">
                                    <StepIndicator current={step} step={1} onStepClick={onStepClick} label="Basic Info" />
                                    <StepIndicator current={step} step={2} onStepClick={onStepClick} label="Templates" />
                                    <StepIndicator current={step} step={3} onStepClick={onStepClick} label="Schedule" />
                                </div>
                            </ModalHeader>

                            <ModalBody className="py-6">
                                {step === 1 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                        <Input 
                                            label="Campaign Name" 
                                            placeholder="Monthly Statements - Feb 2026" 
                                            variant="bordered" 
                                            labelPlacement="outside"
                                            value={campaignName}
                                            onValueChange={setCampaignName}
                                        />
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 h-111.5">
                                        <div className="flex justify-between items-center px-1">
                                            <p className="text-small font-bold text-default-600">
                                                Select Templates ({selectedTemplateIds.length})
                                            </p>
                                            <Input 
                                                placeholder="Search templates..." 
                                                size="sm" 
                                                variant="bordered"
                                                className="max-w-xs"
                                                startContent={<Search size={14} className="text-default-400"/>}
                                                value={searchQuery}
                                                onValueChange={setSearchQuery}
                                            />
                                        </div>

                                        <ScrollShadow 
                                            ref={scrollerRef} 
                                            className="h-112.5 p-1 overflow-y-auto"
                                        >
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {templates.map((template) => (
                                                    <TemplateSelectionCard 
                                                        key={template.id} 
                                                        template={template} 
                                                        isSelected={selectedTemplateIds.includes(template.id)}
                                                        onToggle={() => setSelectedTemplateIds(prev => 
                                                            prev.includes(template.id) 
                                                                ? prev.filter(id => id !== template.id) 
                                                                : [...prev, template.id]
                                                        )}
                                                    />
                                                ))}
                                            </div>

                                            {/* Infinite Scroll Loader */}
                                            {templateStatus === 'loading' && (
                                                <div className="flex justify-center w-full py-6">
                                                    <Spinner color="secondary" size="sm" label="Loading more templates..." />
                                                </div>
                                            )}
                                        </ScrollShadow>
                                    </div>
                                )}
                                {/* Step 3 logic here... */}
                            </ModalBody>

                            <ModalFooter className="bg-default-50 border-t border-default-100">
                                <Button variant="light" onPress={step === 1 ? onClose : () => setStep(s => s - 1)}>
                                    {step === 1 ? 'Cancel' : 'Back'}
                                </Button>
                                <Button 
                                    color="secondary" 
                                    className="font-bold" 
                                    onPress={() => setStep(s => s + 1)}
                                    isDisabled={step === 2 && selectedTemplateIds.length === 0}
                                >
                                    {step === 3 ? 'Launch Campaign' : 'Next Step'}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </>
    )
}

export default NewCampaignButton