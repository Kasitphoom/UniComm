"use client"

import { useMemo, useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
    Accordion,
    AccordionItem,
    Button,
    Card,
    CardBody,
    CardHeader,
    Chip,
    Divider,
    ScrollShadow,
    Tabs,
    Tab,
    Tooltip,
    addToast,
} from "@heroui/react"
import {
    Activity,
    AlertCircle,
    CalendarClock,
    CheckCircle2,
    Clock,
    Download,
    FileText,
    Layers,
    LayoutTemplate,
    Users,
    Play,
    Edit2,
    Trash2,
} from "lucide-react"
import { fromDate, getLocalTimeZone, now, parseAbsoluteToLocal } from "@internationalized/date"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { updateCampaign, deleteCampaign, rerunCampaign, pollCampaignRunStatus } from "@/features/campaigns/campaignsSlice"
import { UserRole } from "@/app/generated/business/prisma"
import { useUserHasPermissionClient } from "@/utils/permissions"
import CampaignWizardModal from "./CampaignWizardModal"
import ConfirmDialog from "../common/ConfirmDialog"
import type { CampaignDetail } from "@/types/campaign"
import type { CampaignFormValues } from "./newCampaignSteps/types"
import { StatusCell } from "./StatusCell"
import { timeDifferenceFormatter } from "@/utils/DateFormatter"

// --- Helper Functions ---

const formatDateTime = (value?: Date | string | null, withTime: boolean = true) => {
    if (!value) return "—"
    const date = typeof value === "string" ? new Date(value) : value
    if (Number.isNaN(date.getTime())) return "—"
    const options: Intl.DateTimeFormatOptions = {
        day: "numeric",
        month: "short",
        year: "numeric",
    }
    if (withTime) {
        options.hour = "2-digit"
        options.minute = "2-digit"
    }
    return date.toLocaleString("en-GB", options)
}

const formatRelative = (value?: Date | string | null) => {
    if (!value) return "—"
    const date = typeof value === "string" ? new Date(value) : value
    if (Number.isNaN(date.getTime())) return "—"
    return timeDifferenceFormatter(date)
}

const isExpired = (value?: Date | string | null, nowTimestamp?: number) => {
    if (!value) return false
    const date = typeof value === "string" ? new Date(value) : value
    const timestamp = date.getTime()
    if (Number.isNaN(timestamp)) return false
    const nowValue = typeof nowTimestamp === "number" ? nowTimestamp : Date.now()
    return timestamp <= nowValue
}

// --- Components ---

const MetricCard = ({ 
    title, 
    value, 
    subtext, 
    icon: Icon, 
    variant = "default" 
}: { 
    title: string; 
    value: string | number; 
    subtext?: string; 
    icon: any;
    variant?: "default" | "success" | "warning";
}) => {
    const colorClass = variant === "success" ? "text-success-600 bg-success-50" :
                      variant === "warning" ? "text-warning-600 bg-warning-50" :
                      "text-secondary-600 bg-secondary-50";

    return (
        <Card className="border border-default-100 shadow-sm h-full">
            <CardBody className="flex flex-row items-center gap-4 p-4">
                <div className={`p-3 rounded-xl ${colorClass}`}>
                    <Icon size={20} />
                </div>
                <div>
                    <p className="text-sm font-medium text-default-500">{title}</p>
                    <div className="flex flex-col">
                        <h4 className="text-xl font-bold text-default-900">{value}</h4>
                        {subtext && <span className="text-xs text-default-400">{subtext}</span>}
                    </div>
                </div>
            </CardBody>
        </Card>
    )
}

const EmptyState = ({ 
    icon: Icon, 
    title, 
    description 
}: { 
    icon: any; 
    title: string; 
    description: string 
}) => (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-default-200 bg-default-50/50 w-full">
        <div className="p-4 rounded-full bg-default-100 text-default-400 mb-4">
            <Icon size={32} />
        </div>
        <h3 className="text-lg font-semibold text-default-900 mb-1">{title}</h3>
        <p className="text-default-500 max-w-xs">{description}</p>
    </div>
)

type Props = {
    campaign: CampaignDetail
}

const CampaignDetailView = ({ campaign }: Props) => {
    const router = useRouter()
    const dispatch = useAppDispatch()

    // Redux State
    const { status: updateStatus } = useAppSelector((state) => state.campaigns.update)
    const { status: deleteStatus, deletingId } = useAppSelector((state) => state.campaigns.remove)
    const { status: rerunStatus, currentId: rerunId, runningIds } = useAppSelector((state) => state.campaigns.rerun)
    const pollingIntervalRef = useRef<number | null>(null)

    const stopPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            window.clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
        }
    }, [])

    const pollOnce = useCallback(async () => {
        try {
            const result = await dispatch(pollCampaignRunStatus(campaign.id)).unwrap()
            if (!result.isRunning) {
                stopPolling()
                addToast({
                    title: "Campaign run completed",
                    description: "Status has been updated.",
                    color: "success",
                })
                router.refresh()
            }
        } catch {
            // Keep polling on transient errors
        }
    }, [campaign.id, dispatch, router, stopPolling])

    const startPolling = useCallback(() => {
        if (pollingIntervalRef.current) return
        void pollOnce()
        pollingIntervalRef.current = window.setInterval(() => {
            void pollOnce()
        }, 5000)
    }, [pollOnce])

    useEffect(() => {
        if (runningIds.includes(campaign.id)) {
            startPolling()
        } else {
            stopPolling()
        }
    }, [campaign.id, runningIds, startPolling, stopPolling])

    useEffect(() => {
        return () => stopPolling()
    }, [stopPolling])

    // Local State
    const [isWizardOpen, setWizardOpen] = useState(false)
    const [campaignToDelete, setCampaignToDelete] = useState<CampaignDetail | null>(null)
    const isDeleteLoading = Boolean(
        campaignToDelete && deleteStatus === "loading" && deletingId === campaignToDelete.id,
    )

    // Permissions
    const canManageCampaigns = useUserHasPermissionClient([UserRole.OWNER, UserRole.ADMIN, UserRole.MEMBER])

    const editInitialValues = useMemo<CampaignFormValues>(() => {
        const timeZone = getLocalTimeZone()
        let scheduleDateValue = now(timeZone).add({ minutes: 5 })

        if (campaign.scheduledAt) {
            scheduleDateValue = campaign.scheduledAt instanceof Date
                ? fromDate(campaign.scheduledAt, timeZone)
                : parseAbsoluteToLocal(campaign.scheduledAt)
        }

        return {
            campaignName: campaign.name ?? "",
            templateId: campaign.templates[0]?.template?.id ?? null,
            customerListId: campaign.contactlist?.id ?? (campaign as unknown as { contactListId?: string | null })?.contactListId ?? null,
            scheduleDate: scheduleDateValue,
        }
    }, [campaign])

    const handleWizardClose = useCallback(() => {
        setWizardOpen(false)
    }, [])

    const handleEdit = useCallback(() => {
        if (!canManageCampaigns) return
        setWizardOpen(true)
    }, [canManageCampaigns])

    const isRerunLoading = (rerunStatus === "loading" && rerunId === campaign.id) || runningIds.includes(campaign.id)

    const handleRerun = useCallback(async () => {
        if (!canManageCampaigns || ((rerunStatus === "loading" && rerunId === campaign.id) || runningIds.includes(campaign.id))) return

        try {
            await dispatch(rerunCampaign(campaign.id)).unwrap()
            startPolling()
            addToast({
                title: "Campaign run triggered",
                description: "Campaign is running in the background.",
                color: "success",
            })
        } catch (error) {
            addToast({
                title: "Failed to re-trigger campaign",
                description: error instanceof Error ? error.message : "Unexpected error",
                color: "danger",
            })
        }
    }, [campaign.id, canManageCampaigns, dispatch, rerunId, rerunStatus, runningIds, startPolling])

    const handleUpdate = useCallback(async (values: CampaignFormValues) => {
        if (!canManageCampaigns || !values.templateId || !values.customerListId || !values.scheduleDate) {
            return
        }

        const scheduledDate = values.scheduleDate.toDate(getLocalTimeZone())
        if (!scheduledDate) return

        try {
            await dispatch(updateCampaign({
                id: campaign.id,
                name: values.campaignName.trim(),
                scheduledAt: scheduledDate.toISOString(),
                templateId: values.templateId,
                customerListId: values.customerListId,
            })).unwrap()

            handleWizardClose()
            addToast({
                title: "Success",
                description: "Campaign updated successfully",
                color: "success",
            })
            router.refresh()
        } catch (error) {
            addToast({
                title: "Failed to update campaign",
                description: error instanceof Error ? error.message : "Unexpected error",
                color: "danger",
            })
        }
    }, [campaign.id, canManageCampaigns, dispatch, handleWizardClose, router])

    const handleDelete = useCallback(() => {
        if (!canManageCampaigns) return
        setCampaignToDelete(campaign)
    }, [campaign, canManageCampaigns])

    const handleConfirmDelete = useCallback(async () => {
        if (!campaignToDelete || !canManageCampaigns) {
            setCampaignToDelete(null)
            return
        }

        try {
            await dispatch(deleteCampaign(campaignToDelete.id)).unwrap()
            addToast({
                title: "Campaign deleted",
                description: `${campaignToDelete.name} has been removed.`,
                color: "secondary",
            })
            router.push("/app/campaigns")
        } catch (error) {
            addToast({
                title: "Failed to delete campaign",
                description: error instanceof Error ? error.message : "Unexpected error",
                color: "danger",
            })
        } finally {
            setCampaignToDelete(null)
        }
    }, [campaignToDelete, canManageCampaigns, dispatch, router])

    // Sort Data

    const sortedFiles = useMemo(() => 
        [...campaign.files].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    , [campaign.files])

    const sortedLogs = useMemo(() => 
        [...campaign.logs]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((log) => ({ ...log, _id: log.id }))
    , [campaign.logs])

    // Derived Data
    const templateTitle = campaign.templates[0]?.template?.title ?? "Untitled template"
    const contactListName = campaign.contactlist?.name ?? "Unknown list"
    const contactCount = campaign.contactlist?._count?.customers ?? campaign.totalRecords
    const fieldCount = Array.isArray(campaign.contactlist?.fields) ? campaign.contactlist?.fields.length ?? 0 : 0
    const nowTimestamp = Date.now()
    const latestAvailableFile = sortedFiles.find((file) => !isExpired(file.expiresAt, nowTimestamp))
    const hasDownloadableFiles = Boolean(latestAvailableFile)
    
    const handleDownloadLatest = useCallback(() => {
        if (!latestAvailableFile) return
        window.open(latestAvailableFile.filePath, "_blank", "noopener,noreferrer")
    }, [latestAvailableFile])

    return (
        <div className="flex flex-col gap-6 w-full h-[calc(100vh-4rem)]">
            {/* Header Section */}
            <header className="flex flex-col gap-4 flex-none pt-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-1">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-xl font-bold text-default-900 tracking-tight">{campaign.name}</h1>
                            <StatusCell status={campaign.scheduleStatus} type="schedule" />
                        </div>
                        <div className="flex items-center gap-4 text-small text-default-500 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <Clock size={14} />
                                <span>Created {formatDateTime(campaign.createdAt)}</span>
                            </div>
                            <Divider orientation="vertical" className="h-4" />
                            <div className="flex items-center gap-1.5">
                                <LayoutTemplate size={14} />
                                <span>{templateTitle}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                            <Tooltip content={canManageCampaigns ? "Re-trigger" : "No permission"} size="sm" color="secondary">
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    color="secondary"
                                    onPress={handleRerun}
                                    isLoading={isRerunLoading}
                                    isDisabled={!canManageCampaigns || isRerunLoading}
                                >
                                    <Play size={16} />
                                </Button>
                            </Tooltip>
                            <Tooltip content={canManageCampaigns ? "Edit" : "No permission"} size="sm">
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    className="text-default-500"
                                    onPress={handleEdit}
                                    isDisabled={!canManageCampaigns}
                                >
                                    <Edit2 size={16} />
                                </Button>
                            </Tooltip>
                            <Tooltip content={canManageCampaigns ? "Delete" : "No permission"} size="sm" color="danger">
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    color="danger"
                                    onPress={handleDelete}
                                    isDisabled={!canManageCampaigns}
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </Tooltip>
                        </div>
                        <Divider orientation="vertical" className="h-6 mx-2" />
                        <Button
                            color="secondary"
                            startContent={<Download size={18} />}
                            onPress={handleDownloadLatest}
                            isDisabled={!hasDownloadableFiles}
                            className="font-medium shadow-sm"
                        >
                            Download Latest
                        </Button>
                    </div>
                </div>
            </header>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-none">
                <MetricCard 
                    title="Audience Size" 
                    value={contactCount.toLocaleString()} 
                    subtext="recipients"
                    icon={Users}
                />
                <MetricCard 
                    title="Scheduled Date" 
                    value={formatDateTime(campaign.scheduledAt, false)} 
                    subtext={campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                    icon={CalendarClock}
                />
                <MetricCard 
                    title="Files Generated" 
                    value={sortedFiles.length} 
                    subtext={sortedFiles.length > 0 ? "Latest: " + formatRelative(sortedFiles[0].createdAt) : "No files yet"}
                    icon={FileText}
                    variant={sortedFiles.length > 0 ? "success" : "default"}
                />
                <MetricCard 
                    title="Execution Status" 
                    value={campaign.executedAt ? "Completed" : "Pending"}
                    subtext={campaign.executedAt ? formatRelative(campaign.executedAt) : "Waiting"}
                    icon={campaign.executedAt ? CheckCircle2 : Activity}
                    variant={campaign.executedAt ? "success" : "warning"}
                />
            </div>

            {/* Content Tabs */}
            <div className="flex flex-col gap-4 flex-1 min-h-0">
            <Tabs 
                aria-label="Campaign details" 
                color="secondary" 
                variant="underlined"
                classNames={{
                    base: "flex-none border-b border-default-200",
                    tabList: "gap-6 w-full relative rounded-none p-0",
                    tab: "max-w-fit px-0 h-12",
                    panel: "flex-1 min-h-0 py-4"
                }}
            >
                {/* FILES TAB */}
                <Tab
                    key="files"
                    title={
                        <div className="flex items-center gap-2">
                            <FileText size={16} />
                            <span>Files & Output</span>
                            {sortedFiles.length > 0 && (
                                <Chip size="sm" variant="flat" color="secondary" className="h-5 px-1 ml-1 text-xs">
                                    {sortedFiles.length}
                                </Chip>
                            )}
                        </div>
                    }
                >
                    <ScrollShadow className="w-full h-100 sm:h-full">
                        {sortedFiles.length > 0 ? (
                            <div className="flex flex-col">
                                {sortedFiles.map((file) => {
                                    const isFileExpired = isExpired(file.expiresAt, nowTimestamp)

                                    return (
                                        <div key={file.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 hover:bg-default-50 transition-colors gap-4 rounded-xl border-b border-default-100 last:border-0 cursor-default">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 rounded-lg bg-default-100 text-default-600">
                                                    <FileText size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-default-900">{file.fileName}</p>
                                                    <p className="text-xs text-default-500 flex items-center gap-2">
                                                        <span>{formatDateTime(file.createdAt)}</span>
                                                        <span>•</span>
                                                        <Tooltip content={file.expiresAt ? formatDateTime(file.expiresAt) : "No expiration"} size="sm">
                                                            <span className="underline">Expires {formatRelative(file.expiresAt)}</span>
                                                        </Tooltip>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 self-end sm:self-auto">
                                                <StatusCell status={file.status} type="file" />
                                                <Button
                                                    isIconOnly
                                                    variant="light"
                                                    size="sm"
                                                    onPress={() => window.open(file.filePath, "_blank", "noopener,noreferrer")}
                                                    isDisabled={isFileExpired}
                                                    className="text-default-400 data-[hover=true]:text-default-900"
                                                >
                                                    <Download size={18} />
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <EmptyState 
                                icon={Layers} 
                                title="No files generated" 
                                description="Files will appear here once the campaign execution begins." 
                            />
                        )}
                    </ScrollShadow>
                </Tab>

                {/* ACTIVITY LOG TAB */}
                <Tab
                    key="activity"
                    title={
                        <div className="flex items-center gap-2">
                            <Activity size={16} />
                            <span>Activity Log</span>
                        </div>
                    }
                >
                    <ScrollShadow className="w-full h-100 sm:h-full">
                        {sortedLogs.length > 0 ? (
                            <Accordion
                                isCompact
                                className="bg-transparent"
                                itemClasses={{
                                    base: "px-0 border border-default-100 bg-transparent",
                                    title: "w-full",
                                    trigger: "px-0 data-[open=true]:bg-default-50 rounded-xl",
                                    content: "p-4",
                                }}
                            >
                                {sortedLogs.map((log) => {
                                    const logKey = log._id ?? log.id
                                    const isSuccess = log.status === "TRIGGERED"
                                    const isFailed = log.status === "FAILED"
                                    const displayStatus = log.status === "TRIGGERED" ? "RUNNING" : log.status
                                    const statusColors = isSuccess
                                        ? "bg-success-50 text-success-600"
                                        : isFailed
                                          ? "bg-danger-50 text-danger-600"
                                          : "bg-primary-50 text-primary-600"
                                    const iconColor = isSuccess
                                        ? "text-success-600"
                                        : isFailed
                                          ? "text-danger-600"
                                          : "text-primary-600"
                                    const detailText = log.message?.trim() || "No additional details."

                                    return (
                                        <AccordionItem
                                            key={logKey}
                                            aria-label={`Activity log ${logKey}`}
                                            title={(
                                                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 w-full">
                                                    <div className={`flex gap-2 items-center p-1.5 rounded-full ${iconColor}`}>
                                                        {isSuccess ? <CheckCircle2 size={16} /> : isFailed ? <AlertCircle size={16} /> : <Clock size={16} />}
                                                        <p className="text-xs text-default-400 font-mono">{formatDateTime(log.createdAt)}</p>
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <p className="text-sm text-default-900 truncate">{log.message || "Status updated"}</p>
                                                    </div>
                                                    <div className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors}`}>
                                                        {displayStatus}
                                                    </div>
                                                </div>
                                            )}
                                        >
                                            <p className="text-sm text-default-600 whitespace-pre-wrap">{detailText}</p>
                                        </AccordionItem>
                                    )
                                })}
                            </Accordion>
                        ) : (
                            <EmptyState 
                                icon={Activity} 
                                title="No activity recorded" 
                                description="Log entries will appear here once the campaign starts processing." 
                            />
                        )}
                    </ScrollShadow>
                </Tab>

                {/* DETAILS TAB */}
                <Tab
                    key="config"
                    title={
                        <div className="flex items-center gap-2">
                            <LayoutTemplate size={16} />
                            <span>Configuration</span>
                        </div>
                    }
                >
                     <ScrollShadow className="h-100 sm:h-full">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
                            <Card className="border border-default-100 shadow-sm h-fit">
                                <CardHeader className="px-6 py-4 border-b border-default-100 bg-default-50/50">
                                    <h3 className="text-base font-semibold">Audience Settings</h3>
                                </CardHeader>
                                <CardBody className="p-6 space-y-6">
                                    <div>
                                        <label className="text-xs font-semibold text-default-400 uppercase tracking-wider">Contact List</label>
                                        <div className="mt-2 flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-secondary-50 text-secondary-600">
                                                <Users size={18} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-default-900">{contactListName}</p>
                                                <p className="text-xs text-default-500">{contactCount.toLocaleString()} total contacts</p>
                                            </div>
                                        </div>
                                    </div>
                                    <Divider />
                                    <div>
                                        <label className="text-xs font-semibold text-default-400 uppercase tracking-wider">Data Mapping</label>
                                        <div className="mt-2">
                                            <p className="text-sm text-default-600">
                                                This campaign uses <span className="font-semibold text-default-900">{fieldCount} data fields</span> from your contact list to populate the template.
                                            </p>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>

                            <Card className="border border-default-100 shadow-sm h-fit">
                                <CardHeader className="px-6 py-4 border-b border-default-100 bg-content2/20">
                                    <h3 className="text-base font-semibold">Template Settings</h3>
                                </CardHeader>
                                <CardBody className="p-6 space-y-6">
                                    <div>
                                        <label className="text-xs font-semibold text-default-400 uppercase tracking-wider">Design File</label>
                                        <div className="mt-2 flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-pink-50 text-pink-600">
                                                <Layers size={18} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-default-900">{templateTitle}</p>
                                                <p className="text-xs text-default-500">PDF Generator Template</p>
                                            </div>
                                        </div>
                                    </div>
                                    <Divider />
                                    <div>
                                        <label className="text-xs font-semibold text-default-400 uppercase tracking-wider">Export Format</label>
                                        <div className="mt-2">
                                            <Chip size="sm" variant="flat" color="warning">PDF Document</Chip>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    </ScrollShadow>
                </Tab>
            </Tabs>
            </div>

            {/* Modals */}
            <CampaignWizardModal
                isOpen={isWizardOpen && canManageCampaigns}
                onOpenChange={setWizardOpen}
                onClose={handleWizardClose}
                onSubmit={handleUpdate}
                mode="edit"
                initialValues={editInitialValues}
                title="Edit Campaign"
                submitLabel="Save Changes"
                isSubmitting={updateStatus === "loading"}
            />

            <ConfirmDialog
                isOpen={!!campaignToDelete && canManageCampaigns}
                title={
                    <div className="space-y-1">
                        <h2 className="font-semibold text-large">Delete campaign</h2>
                        <p className="text-tiny text-default-400">This action cannot be undone.</p>
                    </div>
                }
                content={campaignToDelete ? (
                    <p className="py-2">
                        Are you sure you want to delete <span className="font-semibold">{campaignToDelete.name}</span>?
                    </p>
                ) : null}
                onCancel={() => setCampaignToDelete(null)}
                onConfirm={handleConfirmDelete}
                confirmText="Delete"
                confirmButtonProps={{ color: "danger" }}
                isConfirmLoading={isDeleteLoading}
            />
        </div>
    )
}

export default CampaignDetailView
