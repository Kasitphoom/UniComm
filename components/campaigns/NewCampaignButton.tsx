"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
    Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
    Button, useDisclosure,
} from '@heroui/react'
import { useForm } from 'react-hook-form'
import { PlusIcon, Send } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchTemplates } from '@/features/templates/templatesSlice'
import { fetchCustomerLists } from '@/features/customers/customerListsSlice'
import { useInfiniteScroll } from '@heroui/use-infinite-scroll'
import { getLocalTimeZone, now } from '@internationalized/date'
import BasicInfoStep from './newCampaignSteps/BasicInfoStep'
import TemplateSelectionStep from './newCampaignSteps/TemplateSelectionStep'
import { CustomerListSelectorStep } from './newCampaignSteps/CustomerListSelectorStep'
import ScheduleStep from './newCampaignSteps/ScheduleStep'
import SummaryStep from './newCampaignSteps/SummaryStep'
import type { CampaignFormValues } from './newCampaignSteps/types'

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
            scheduleDate: now(getLocalTimeZone()).add({ minutes: 5 }),
        },
    })

    const campaignNameValue = watch('campaignName')
    const selectedTemplateId = watch('templateId')
    const selectedCustomerListId = watch('customerListId')
    const scheduleDateValue = watch('scheduleDate')

    // Redux State
    const { items: templates, status: templateStatus, totalPages } = useAppSelector((state) => state.templates.list);
    const { items: customerLists, status: contactListStatus } = useAppSelector((state) => state.customerLists.list);

    const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) || null
    const selectedCustomerList = customerLists.find((list) => list.id === selectedCustomerListId) || null

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
        setStep((prev) => Math.min(prev + 1, 5))
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
        (step === 3 && !hasCompatibleCustomerList) ||
        (step === 4 && !scheduleDateValue)
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
                                    labels={["Basic Info", "Templates", "Customers", "Schedule", "Summary"]}
                                    onStepClick={onStepClick}
                                />
                            </ModalHeader>

                            <ModalBody className="py-6">
                                <form id="campaignForm" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                    {step === 1 && (
                                        <BasicInfoStep control={control} />
                                    )}

                                    {step === 2 && (
                                        <TemplateSelectionStep
                                            templates={templates}
                                            selectedTemplateId={selectedTemplateId}
                                            searchQuery={searchQuery}
                                            onSearchChange={setSearchQuery}
                                            onTemplateToggle={handleTemplateToggle}
                                            scrollerRef={scrollerRef}
                                            isLoading={templateStatus === 'loading'}
                                        />
                                    )}

                                    {step === 3 && (
                                        <CustomerListSelectorStep
                                            templateId={selectedTemplateId}
                                            selectedCustomerListId={selectedCustomerListId}
                                            onCustomerListChange={handleCustomerListChange}
                                            onCompatibilityChange={handleCompatibilityChange}
                                        />
                                    )}

                                    {step === 4 && (
                                        <ScheduleStep control={control} />
                                    )}

                                    {step === 5 && (
                                        <SummaryStep
                                            campaignName={campaignNameValue}
                                            template={selectedTemplate}
                                            customerList={selectedCustomerList}
                                            scheduleDate={scheduleDateValue}
                                            isCustomerListCompatible={isCustomerListCompatible}
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
                                    type={step === 5 ? 'submit' : 'button'}
                                    form={step === 5 ? 'campaignForm' : undefined}
                                    onPress={step === 5 ? undefined : handleNextStep}
                                    isDisabled={isNextDisabled}
                                >
                                    {step === 5 ? 'Launch Campaign' : 'Next Step'}
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