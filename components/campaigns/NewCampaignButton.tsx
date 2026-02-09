"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { 
    Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, 
    Button, useDisclosure, Input, ScrollShadow, Checkbox, 
    User, Chip, Divider, Badge,
    Spinner
} from '@heroui/react'
import { Controller, useForm } from 'react-hook-form'
import { PlusIcon, Search, Layout, Users, Calendar, Send, CheckCircle2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import { TemplateWithUser } from '@/types/template'
import { clientFetchParsedTemplate } from '@/utils/template/utils'
import { Template } from '@pdfme/common'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchTemplates } from '@/features/templates/templatesSlice'
import { fetchCustomerLists } from '@/features/customers/customerListsSlice'
import { useInfiniteScroll } from '@heroui/use-infinite-scroll'
import { CustomerListSelectorStep } from './CampaignCustomerListSelectorStep'

// Dynamically import the viewer to keep the modal light
const PdfViewer = dynamic(() => import('@/components/PdfViewer'), { ssr: false })

export const TemplateSelectionCard = ({ template, isSelected, onToggle }: {
    template: TemplateWithUser,
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

type CampaignFormValues = {
    campaignName: string
    templateId: string | null
    customerListId: string | null
}

const StepIndicator = ({ 
    current, 
    labels, 
    onStepClick 
}: {
    current: number,
    labels: string[],
    onStepClick: (step: number) => void
}) => (
    <div className="flex gap-4 mt-2">
        {labels.map((label, index) => {
            const stepNumber = index + 1
            const isReachable = stepNumber <= current
            const isActive = stepNumber === current

            return (
                <div 
                    key={`${label}-${stepNumber}`}
                    onClick={() => isReachable && onStepClick(stepNumber)}
                    className={`
                        flex items-center gap-2 transition-all duration-200
                        ${isReachable ? 'cursor-pointer group' : 'cursor-not-allowed opacity-50'}
                        ${isActive ? 'text-secondary' : 'text-default-400'}
                    `}
                >
                    <div className={`
                        w-6 h-6 rounded-full flex items-center justify-center text-[10px] border-1 transition-colors
                        ${isActive 
                            ? 'border-secondary bg-secondary text-white font-bold' 
                            : 'border-default-300 group-hover:border-secondary group-hover:text-secondary'}
                    `}>
                        {stepNumber}
                    </div>
                    
                    <span className={`text-tiny font-bold uppercase tracking-wider ${isReachable && 'group-hover:text-secondary'}`}>
                        {label}
                    </span>

                    {index < labels.length - 1 && <div className="w-6 h-px bg-default-200 mx-1" />}
                </div>
            )
        })}
    </div>
)

const NewCampaignButton = () => {
    const dispatch = useAppDispatch();
    const { isOpen, onOpen, onOpenChange } = useDisclosure()
    const [step, setStep] = useState(1)
    
    // Pagination & Search State
    const [page, setPage] = useState(1)
    const [searchQuery, setSearchQuery] = useState("")
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
    const [isCustomerListCompatible, setIsCustomerListCompatible] = useState<boolean | null>(null)

    const previousTemplateIdRef = useRef<string | null>(null)

    const {
        control,
        handleSubmit,
        watch,
        setValue,
        reset,
    } = useForm<CampaignFormValues>({
        mode: 'onChange',
        defaultValues: {
            campaignName: '',
            templateId: null,
            customerListId: null,
        },
    })

    const campaignNameValue = watch('campaignName')
    const selectedTemplateId = watch('templateId')
    const selectedCustomerListId = watch('customerListId')

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

    useEffect(() => {
        if (!isOpen) {
            setStep(1)
            setPage(1)
            setSearchQuery('')
            setDebouncedSearchQuery('')
            setIsCustomerListCompatible(null)
            reset()
        }
    }, [isOpen, reset])

    useEffect(() => {
        if (previousTemplateIdRef.current === selectedTemplateId) return

        previousTemplateIdRef.current = selectedTemplateId

        if (selectedCustomerListId) {
            setValue('customerListId', null, { shouldDirty: true })
        }
        setIsCustomerListCompatible(null)
    }, [selectedCustomerListId, selectedTemplateId, setValue])

    const onStepClick = (newStep: number) => {
        if (newStep < step) {
            setStep(newStep)
        }
    }

    const handleTemplateToggle = (templateId: string) => {
        const nextValue = selectedTemplateId === templateId ? null : templateId
        setValue('templateId', nextValue, { shouldDirty: true })
    }

    const handleCustomerListChange = useCallback((listId: string | null) => {
        setValue('customerListId', listId, { shouldDirty: true })
    }, [setValue])

    const handleCompatibilityChange = useCallback((compatible: boolean | null) => {
        setIsCustomerListCompatible(compatible)
    }, [])

    const handleNextStep = () => {
        setStep((prev) => Math.min(prev + 1, 4))
    }

    const onSubmit = (values: CampaignFormValues) => {
        console.log('Campaign form values', values)
    }

    const hasCampaignName = Boolean(campaignNameValue.trim())
    const hasTemplateSelected = Boolean(selectedTemplateId)
    const hasCompatibleCustomerList = Boolean(selectedCustomerListId && isCustomerListCompatible)

    const isNextDisabled = (
        (step === 1 && !hasCampaignName) ||
        (step === 2 && !hasTemplateSelected) ||
        (step === 3 && !hasCompatibleCustomerList)
    )

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
                                <StepIndicator 
                                    current={step} 
                                    labels={["Basic Info", "Templates", "Customers", "Schedule"]} 
                                    onStepClick={onStepClick} 
                                />
                            </ModalHeader>

                            <ModalBody className="py-6">
                                <form id="campaignForm" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                    {step === 1 && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                            <Controller 
                                                name="campaignName"
                                                control={control}
                                                rules={{ required: true }}
                                                render={({ field }) => (
                                                    <Input 
                                                        {...field}
                                                        label="Campaign Name" 
                                                        placeholder="Monthly Statements - Feb 2026" 
                                                        variant="bordered" 
                                                        labelPlacement="outside"
                                                        value={field.value}
                                                        onValueChange={field.onChange}
                                                    />
                                                )}
                                            />
                                        </div>
                                    )}

                                    {step === 2 && (
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
                                                            isSelected={selectedTemplateId === template.id}
                                                            onToggle={() => handleTemplateToggle(template.id)}
                                                        />
                                                    ))}
                                                </div>

                                                {templateStatus === 'loading' && (
                                                    <div className="flex justify-center w-full py-6">
                                                        <Spinner color="secondary" size="sm" label="Loading more templates..." />
                                                    </div>
                                                )}
                                            </ScrollShadow>
                                        </div>
                                    )}

                                    {step === 3 && (
                                        <CustomerListSelectorStep 
                                            templateId={selectedTemplateId} 
                                            selectedCustomerListId={selectedCustomerListId}
                                            onCustomerListChange={handleCustomerListChange}
                                            onCompatibilityChange={handleCompatibilityChange}
                                        />
                                    )}
                                    </form>
                                </ModalBody>

                                <ModalFooter className="bg-default-50 border-t border-default-100">
                                    <Button 
                                        type="button"
                                        variant="light" 
                                        onPress={step === 1 ? onClose : () => setStep(s => Math.max(s - 1, 1))}
                                    >
                                        {step === 1 ? 'Cancel' : 'Back'}
                                    </Button>
                                    <Button 
                                        color="secondary" 
                                        className="font-bold" 
                                        type={step === 4 ? 'submit' : 'button'}
                                        form={step === 4 ? 'campaignForm' : undefined}
                                        onPress={step === 4 ? undefined : handleNextStep}
                                        isDisabled={isNextDisabled}
                                    >
                                        {step === 4 ? 'Launch Campaign' : 'Next Step'}
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