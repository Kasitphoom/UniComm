"use client"

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
} from "@heroui/react"
import { useInfiniteScroll } from "@heroui/use-infinite-scroll"
import { useForm, useWatch } from "react-hook-form"
import { Send } from "lucide-react"
import { getLocalTimeZone, now } from "@internationalized/date"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { fetchTemplates } from "@/features/templates/templatesSlice"
import { fetchCustomerLists } from "@/features/customers/customerListsSlice"
import BasicInfoStep from "./newCampaignSteps/BasicInfoStep"
import TemplateSelectionStep from "./newCampaignSteps/TemplateSelectionStep"
import { CustomerListSelectorStep } from "./newCampaignSteps/CustomerListSelectorStep"
import ScheduleStep from "./newCampaignSteps/ScheduleStep"
import SummaryStep from "./newCampaignSteps/SummaryStep"
import type { CampaignFormValues } from "./newCampaignSteps/types"

const STEP_LABELS = ["Basic Info", "Templates", "Customers", "Schedule", "Summary"]

const StepIndicator = ({
    current,
    labels,
    onStepClick,
}: {
    current: number
    labels: string[]
    onStepClick: (step: number) => void
}) => (
    <div className="flex items-center justify-between md:justify-start gap-2 md:gap-4 mt-2 overflow-x-auto no-scrollbar py-1">
        {labels.map((label, index) => {
            const stepNumber = index + 1
            const isReachable = stepNumber <= current
            const isActive = stepNumber === current

            return (
                <div
                    key={`${label}-${stepNumber}`}
                    onClick={() => isReachable && onStepClick(stepNumber)}
                    className={`flex items-center gap-2 flex-shrink-0 transition-all duration-200 
                        ${isReachable ? "cursor-pointer group" : "cursor-not-allowed opacity-50"}`}
                >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] border-1 transition-colors
                            ${isActive ? "border-secondary bg-secondary text-white font-bold" : "border-default-300 text-default-400"}`}
                    >
                        {stepNumber}
                    </div>

                    {/* Hide label on small mobile devices, show on tablet/desktop */}
                    <span className={`hidden sm:inline text-tiny font-bold uppercase tracking-wider 
                        ${isActive ? "text-secondary" : "text-default-400"}`}
                    >
                        {label}
                    </span>

                    {/* Compact connector for mobile */}
                    {index < labels.length - 1 && (
                        <div className="w-4 md:w-6 h-px bg-default-200 ml-1" />
                    )}
                </div>
            )
        })}
    </div>
)

export type CampaignWizardModalProps = {
    isOpen: boolean
    onOpenChange: (isOpen: boolean) => void
    onClose: () => void
    onSubmit: (values: CampaignFormValues) => Promise<void> | void
    mode?: "create" | "edit"
    initialValues?: Partial<CampaignFormValues>
    title?: string
    submitLabel?: string
    isSubmitting?: boolean
}

const buildDefaultValues = (initialValues?: Partial<CampaignFormValues>): CampaignFormValues => ({
    campaignName: initialValues?.campaignName ?? "",
    templateId: initialValues?.templateId ?? null,
    customerListId: initialValues?.customerListId ?? null,
    scheduleDate:
        initialValues?.scheduleDate ?? now(getLocalTimeZone()).add({ minutes: 5 }),
})

const CampaignWizardModal: React.FC<CampaignWizardModalProps> = ({
    isOpen,
    onOpenChange,
    onClose,
    onSubmit,
    mode = "create",
    initialValues,
    title,
    submitLabel,
    isSubmitting = false,
}) => {
    const dispatch = useAppDispatch()
    const [step, setStep] = useState(1)
    const [page, setPage] = useState(1)
    const [searchQuery, setSearchQuery] = useState("")
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
    const [isCustomerListCompatible, setIsCustomerListCompatible] = useState<boolean | null>(null)
    const previousTemplateIdRef = useRef<string | null>(null)

    const defaultValues = useMemo(() => buildDefaultValues(initialValues), [initialValues])

    const {
        control,
        handleSubmit,
        setValue,
        reset,
    } = useForm<CampaignFormValues>({
        mode: "onChange",
        defaultValues,
    })

    const campaignNameValue = useWatch({ control, name: "campaignName" })
    const selectedTemplateId = useWatch({ control, name: "templateId" })
    const selectedCustomerListId = useWatch({ control, name: "customerListId" })
    const scheduleDateValue = useWatch({ control, name: "scheduleDate" })

    const { items: templates, status: templateStatus, totalPages } = useAppSelector((state) => state.templates.list)
    const { items: customerLists, status: contactListStatus } = useAppSelector((state) => state.customerLists.list)

    const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) || null
    const selectedCustomerList = customerLists.find((list) => list.id === selectedCustomerListId) || null

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery)
            setPage(1)
        }, 300)
        return () => clearTimeout(timeoutId)
    }, [searchQuery])

    useEffect(() => {
        if (!isOpen) return
        dispatch(fetchTemplates({ query: debouncedSearchQuery, page: 1, perPage: 9 }))
    }, [dispatch, debouncedSearchQuery, isOpen])

    useEffect(() => {
        if (isOpen && contactListStatus === "idle") {
            dispatch(fetchCustomerLists())
        }
    }, [dispatch, contactListStatus, isOpen])

    const loadMore = useCallback(() => {
        const hasMore = page < totalPages
        if (templateStatus === "loading" || !hasMore) return

        const nextPage = page + 1
        setPage(nextPage)
        dispatch(fetchTemplates({ query: debouncedSearchQuery, page: nextPage, perPage: 9 }))
    }, [dispatch, templateStatus, page, totalPages, debouncedSearchQuery])

    const [, scrollerRef] = useInfiniteScroll({
        hasMore: page < totalPages,
        isEnabled: isOpen && step === 2,
        shouldUseLoader: false,
        onLoadMore: loadMore,
    })

    const resetModalState = useCallback(() => {
        setStep(1)
        setPage(1)
        setSearchQuery("")
        setDebouncedSearchQuery("")
        setIsCustomerListCompatible(null)
    }, [])

    const resetCustomerListCompatibility = useCallback(() => {
        setIsCustomerListCompatible(null)
    }, [])

    useEffect(() => {
        if (isOpen) {
            reset(defaultValues)
        }
    }, [isOpen, defaultValues, reset])

    useEffect(() => {
        if (isOpen) return
        // eslint-disable-next-line react-hooks/set-state-in-effect
        resetModalState()
    }, [isOpen, resetModalState])

    useEffect(() => {
        if (previousTemplateIdRef.current === selectedTemplateId) return

        previousTemplateIdRef.current = selectedTemplateId ?? null

        if (selectedCustomerListId) {
            setValue("customerListId", null, { shouldDirty: true })
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        resetCustomerListCompatibility()
    }, [selectedCustomerListId, selectedTemplateId, setValue, resetCustomerListCompatibility])

    const onStepClick = (newStep: number) => {
        if (newStep < step) {
            setStep(newStep)
        }
    }

    const handleTemplateToggle = (templateId: string) => {
        const nextValue = selectedTemplateId === templateId ? null : templateId
        setValue("templateId", nextValue, { shouldDirty: true })
    }

    const handleCustomerListChange = useCallback((listId: string | null) => {
        setValue("customerListId", listId, { shouldDirty: true })
    }, [setValue])

    const handleCompatibilityChange = useCallback((compatible: boolean | null) => {
        setIsCustomerListCompatible(compatible)
    }, [])

    const handleNextStep = () => {
        setStep((prev) => Math.min(prev + 1, STEP_LABELS.length))
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

    const modalTitle = title ?? (mode === "edit" ? "Edit Campaign" : "Campaign Automation Wizard")
    const finalSubmitLabel = submitLabel ?? (mode === "edit" ? "Save Changes" : "Launch Campaign")

    const handleFormSubmit = async (values: CampaignFormValues) => {
        if (!values.templateId || !values.customerListId || !values.scheduleDate) {
            return
        }

        try {
            await onSubmit({
                ...values,
                campaignName: values.campaignName.trim(),
            })
            onClose()
        } catch (error) {
            console.error("Failed to submit campaign wizard", error)
        }
    }

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="4xl" scrollBehavior="inside" backdrop="blur">
            <ModalContent>
                {(closeHandler) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1 border-b border-default-100">
                            <div className="flex items-center gap-2">
                                <Send size={18} />
                                <span className="font-bold">{modalTitle}</span>
                            </div>
                            <StepIndicator
                                current={step}
                                labels={STEP_LABELS}
                                onStepClick={onStepClick}
                            />
                        </ModalHeader>

                        <ModalBody className="py-6">
                            <form id="campaignForm" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
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
                                        isLoading={templateStatus === "loading"}
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
                                onPress={step === 1 ? closeHandler : () => setStep((s) => Math.max(s - 1, 1))}
                            >
                                {step === 1 ? "Cancel" : "Back"}
                            </Button>
                            {step < STEP_LABELS.length ? (
                                <Button
                                    key="campaign-next"
                                    color="secondary"
                                    className="font-bold"
                                    type="button"
                                    onPress={handleNextStep}
                                    isDisabled={isNextDisabled}
                                >
                                    Next Step
                                </Button>
                            ) : (
                                <Button
                                    key="campaign-submit"
                                    color="secondary"
                                    className="font-bold"
                                    type="submit"
                                    form="campaignForm"
                                    isDisabled={isNextDisabled}
                                    isLoading={isSubmitting}
                                >
                                    {finalSubmitLabel}
                                </Button>
                            )}
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    )
}

export default CampaignWizardModal
