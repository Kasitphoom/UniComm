"use client"

import { useEffect, useMemo, useCallback, useState } from "react"
import type { Key } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    Tooltip,
    Spinner,
    Pagination,
    Button,
    PressEvent,
    Card,
    CardBody,
    addToast,
} from "@heroui/react"
import { Edit2, Trash2, Play, Calendar } from "lucide-react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { fetchCampaigns, type FetchCampaignsParams, updateCampaign, deleteCampaign, rerunCampaign } from "@/features/campaigns/campaignsSlice"
import { UserRole } from "@/app/generated/business/prisma"
import type { FILE_STATUS, SCHEDULE_STATUS } from "@/app/generated/business/prisma"
import { StatusCell } from "./StatusCell"
import { CampaignWithRelations } from "@/types/campaign"
import CampaignWizardModal from "./CampaignWizardModal"
import type { CampaignFormValues } from "./newCampaignSteps/types"
import { getLocalTimeZone, parseAbsoluteToLocal, fromDate } from "@internationalized/date"
import ConfirmDialog from "@/components/common/ConfirmDialog"
import { userHasPermissionClient } from "@/utils/permissions"

export const CampaignTable = () => {
    const dispatch = useAppDispatch()
    const router = useRouter()
    const searchParams = useSearchParams()
    const {
        items: campaigns,
        status,
        totalPages,
        currentPage,
        error,
    } = useAppSelector((state) => state.campaigns.list)
    const { status: updateStatus } = useAppSelector((state) => state.campaigns.update)
    const { status: deleteStatus, deletingId } = useAppSelector((state) => state.campaigns.remove)
    const { status: rerunStatus, currentId: rerunId } = useAppSelector((state) => state.campaigns.rerun)

    const [isWizardOpen, setWizardOpen] = useState(false)
    const [editingCampaign, setEditingCampaign] = useState<CampaignWithRelations | null>(null)
    const [campaignToDelete, setCampaignToDelete] = useState<CampaignWithRelations | null>(null)
    const isDeleteLoading = Boolean(
        campaignToDelete && deleteStatus === "loading" && deletingId === campaignToDelete.id,
    )
    const canManageCampaigns = userHasPermissionClient([
        UserRole.OWNER,
        UserRole.ADMIN,
        UserRole.MEMBER,
    ])

    const paramsString = searchParams.toString()
    const sort = (searchParams.get("sort") || "desc") as "asc" | "desc"

    const campaignParams = useMemo<FetchCampaignsParams>(() => {
        const params = new URLSearchParams(paramsString)
        return {
            query: params.get("query") || undefined,
            page: Math.max(1, Number(params.get("page")) || 1),
            perPage: Number(params.get("perPage")) || 10,
            fileStatus: params.getAll("fileStatus") as FILE_STATUS[],
            scheduleStatus: params.getAll("scheduleStatus") as SCHEDULE_STATUS[],
            range: params.get("range") as any,
            startDate: params.get("startDate") || undefined,
            endDate: params.get("endDate") || undefined,
        }
    }, [paramsString])

    useEffect(() => {
        dispatch(fetchCampaigns(campaignParams))
    }, [dispatch, campaignParams])

    const handleAction = useCallback( async (_event: PressEvent, type: string, id: string) => {
        switch (type) {
            case "retrigger":
                if (rerunStatus === "loading" && rerunId === id) return
                try {
                    await dispatch(rerunCampaign(id)).unwrap()
                    addToast({
                        title: "Campaign run triggered",
                        description: "We will update the status once the files are ready.",
                        color: "success",
                    })
                } catch (error) {
                    addToast({
                        title: "Failed to rerun campaign",
                        description: error instanceof Error ? error.message : "Unexpected error",
                        color: "danger",
                    })
                }
                break
            default:
                break
        }
    }, [dispatch, rerunId, rerunStatus])

    const handleWizardClose = useCallback(() => {
        setWizardOpen(false)
        setEditingCampaign(null)
    }, [])

    const handleWizardOpenChange = useCallback((open: boolean) => {
        if (!open || !canManageCampaigns) {
            handleWizardClose()
            return
        }
        setWizardOpen(true)
    }, [handleWizardClose, canManageCampaigns])

    const handleEditAction = useCallback((campaign: CampaignWithRelations) => {
        if (!canManageCampaigns) return
        setEditingCampaign(campaign)
        setWizardOpen(true)
    }, [canManageCampaigns])

    const handleDeleteAction = useCallback((campaign: CampaignWithRelations) => {
        if (!canManageCampaigns) return
        setCampaignToDelete(campaign)
    }, [canManageCampaigns])

    const onPageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("page", newPage.toString())
        router.push(`?${params.toString()}`)
    }

    const onSortChange = (descriptor: { column?: string | number; direction: "ascending" | "descending" }) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("sort", descriptor.direction === "ascending" ? "asc" : "desc")
        params.set("page", "1")
        router.push(`?${params.toString()}`)
    }

    const sortedCampaigns = useMemo(() => {
        const sorted = [...campaigns].sort((a, b) => {
            const nameA = a.name?.toLowerCase() || ""
            const nameB = b.name?.toLowerCase() || ""
            return sort === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
        })

        if (rerunStatus === "idle" && !rerunId) {
            return sorted
        }

        // Clone the campaign objects so the HeroUI Table re-renders action cells when rerun state flips
        return sorted.map((campaign) => ({ ...campaign }))
    }, [campaigns, sort, rerunId, rerunStatus])

    const editInitialValues = useMemo<CampaignFormValues | undefined>(() => {
        if (!editingCampaign) return undefined
        const timeZone = getLocalTimeZone()
        const scheduleDateValue = editingCampaign.scheduledAt instanceof Date
            ? fromDate(editingCampaign.scheduledAt, timeZone)
            : parseAbsoluteToLocal(editingCampaign.scheduledAt)
        return {
            campaignName: editingCampaign.name,
            templateId: editingCampaign.templates[0]?.template?.id ?? null,
            customerListId: editingCampaign.contactListId ?? null,
            scheduleDate: scheduleDateValue,
        }
    }, [editingCampaign])

    const handleEditSubmit = useCallback(async (values: CampaignFormValues) => {
        if (!canManageCampaigns || !editingCampaign || !values.templateId || !values.customerListId || !values.scheduleDate) {
            return
        }

        const scheduledDate = values.scheduleDate.toDate(getLocalTimeZone())
        if (!scheduledDate) return

        await dispatch(updateCampaign({
            id: editingCampaign.id,
            name: values.campaignName.trim(),
            scheduledAt: scheduledDate.toISOString(),
            templateId: values.templateId,
            customerListId: values.customerListId,
        })).unwrap()

        handleWizardClose()
    }, [dispatch, editingCampaign, handleWizardClose, canManageCampaigns])

    const handleDeleteConfirm = useCallback(async () => {
        if (!canManageCampaigns || !campaignToDelete) {
            setCampaignToDelete(null)
            return
        }
        const targetId = campaignToDelete.id
        const targetName = campaignToDelete.name
        try {
            await dispatch(deleteCampaign(targetId)).unwrap()
            addToast({
                title: "Campaign deleted",
                description: `${targetName} has been removed.`,
                color: "secondary",
            })
        } catch (error) {
            addToast({
                title: "Failed to delete campaign",
                description: error instanceof Error ? error.message : "Unexpected error",
                color: "danger",
            })
        } finally {
            setCampaignToDelete(null)
        }
    }, [campaignToDelete, dispatch, canManageCampaigns])

    const renderCell = useCallback((campaign: CampaignWithRelations, columnKey: Key) => {
        switch (columnKey) {
            case "name":
                return (
                    <div className="flex flex-col">
                        <span className="text-small font-semibold text-default-800">{campaign.name}</span>
                    </div>
                )
            case "templates":
                return (
                    <div className="flex -space-x-2">
                        {campaign.templates.slice(0, 3).map((ct) => (
                            <div
                                key={ct.id}
                                className="w-8 h-8 rounded-full bg-secondary-50 border-2 border-white flex items-center justify-center text-[10px] font-bold text-secondary"
                            >
                                {ct.template.title.charAt(0).toUpperCase()}
                            </div>
                        ))}
                        {campaign.templates.length > 3 && (
                            <div className="w-8 h-8 rounded-full bg-default-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-default-500">
                                +{campaign.templates.length - 3}
                            </div>
                        )}
                    </div>
                )
            case "scheduled":
                return (
                    <div className="flex flex-col text-tiny">
                        <div className="flex items-center gap-1 font-semibold text-default-600">
                            <Calendar size={12} />
                            <span>{new Date(campaign.scheduledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                    </div>
                )
            case "records":
                return (
                    <span className="text-tiny font-bold text-default-500">
                        {campaign.totalRecords.toLocaleString()}
                    </span>
                )
            case "status":
                return (
                    <div className="flex gap-2">
                        <StatusCell status={campaign.scheduleStatus} type="schedule" />
                        <StatusCell status={campaign.fileStatus} type="file" />
                    </div>
                )
            case "actions":
                return (
                    <div className="flex items-center justify-center gap-2">
                        <Tooltip content="Re-trigger" size="sm" color="secondary">
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color="secondary"
                                onPress={(e) => handleAction(e, "retrigger", campaign.id)}
                                isLoading={rerunStatus === "loading" && rerunId === campaign.id}
                                isDisabled={rerunStatus === "loading" && rerunId === campaign.id}
                                startContent={!(rerunStatus === "loading" && rerunId === campaign.id) && <Play size={16} fill="currentColor" />}
                            />
                        </Tooltip>
                        <Tooltip content={canManageCampaigns ? "Edit" : "No permission"} size="sm">
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                className="text-default-500"
                                onPress={(e) => {
                                    handleEditAction(campaign)
                                }}
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
                                onPress={(e) => {
                                    handleDeleteAction(campaign)
                                }}
                                isDisabled={!canManageCampaigns}
                            >
                                <Trash2 size={16} />
                            </Button>
                        </Tooltip>
                    </div>
                )
            default:
                return null
        }
    }, [handleAction, handleEditAction, handleDeleteAction, canManageCampaigns, rerunId, rerunStatus])

    if (status === "failed") {
        return (
            <div className="flex justify-center items-center min-h-100 text-danger">
                <p>Error loading campaigns: {error}</p>
            </div>
        )
    }

    const columns = [
        { name: "CAMPAIGN", uid: "name" },
        { name: "TEMPLATES", uid: "templates" },
        { name: "SCHEDULED", uid: "scheduled" },
        { name: "RECORDS", uid: "records" },
        { name: "STATUS", uid: "status" },
        { name: "ACTIONS", uid: "actions" },
    ]

    const MobileCampaignCard = ({ campaign }: { campaign: CampaignWithRelations }) => (
        <Card className="mb-3 shadow-sm border-none bg-white lg:hidden">
            <CardBody className="p-5 space-y-5">
                {/* TOP: Identity & Status */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                        <p className="text-small font-bold text-default-800 leading-tight">
                            {campaign.name}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <StatusCell status={campaign.scheduleStatus} type="schedule" />
                        <StatusCell status={campaign.fileStatus} type="file" />
                    </div>
                </div>

                {/* MIDDLE: Data Points (Grid for better use of space) */}
                <div className="grid grid-cols-2 gap-4 py-1">
                    {/* Templates Section */}
                    <div className="space-y-2">
                        <p className="text-[10px] uppercase text-default-300 font-bold tracking-widest">
                            Templates
                        </p>
                        <div className="flex -space-x-2">
                            {campaign.templates.slice(0, 3).map((ct) => (
                                <div
                                    key={ct.id}
                                    className="w-7 h-7 rounded-full bg-secondary-50 border-2 border-white flex items-center justify-center text-[10px] font-bold text-secondary-400"
                                >
                                    {ct.template.title.charAt(0).toUpperCase()}
                                </div>
                            ))}
                            {campaign.templates.length > 3 && (
                                <div className="w-7 h-7 rounded-full bg-default-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-default-500">
                                    +{campaign.templates.length - 3}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Records Section */}
                    <div className="space-y-2 text-right">
                        <p className="text-[10px] uppercase text-default-300 font-bold tracking-widest">
                            Records
                        </p>
                        <span className="text-tiny font-mono font-bold text-default-500 bg-default-50 px-2 py-0.5 rounded-md">
                            {campaign.totalRecords.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* SCHEDULE: Minimalist Execution Window */}
                <div className="flex items-center gap-2 py-2 px-3 bg-[#F4F4F5] rounded-xl text-tiny">
                    <Calendar size={12} className="text-default-400" />
                    <span className="text-default-500 font-medium">
                        {new Date(campaign.scheduledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                    <span className="text-default-300">·</span>
                    <span className="text-default-500 font-medium">
                        {new Date(campaign.scheduledAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                </div>

                {/* BOTTOM: Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-default-50">
                    <Button 
                        isIconOnly 
                        size="sm" 
                        variant="light" 
                        color="secondary" 
                        onPress={(e) => handleAction(e, "retrigger", campaign.id)}
                        isLoading={rerunStatus === "loading" && rerunId === campaign.id}
                        isDisabled={rerunStatus === "loading" && rerunId === campaign.id}
                    >
                        <Play size={16} fill="currentColor" />
                    </Button>
                    <Button 
                        isIconOnly 
                        size="sm" 
                        variant="light" 
                        className="text-default-400" 
                        onPress={(e) => {
                            handleEditAction(campaign)
                        }}
                        isDisabled={!canManageCampaigns}
                    >
                        <Edit2 size={16} />
                    </Button>
                    <Button 
                        isIconOnly 
                        size="sm" 
                        variant="light" 
                        color="danger" 
                        onPress={(e) => {
                            handleDeleteAction(campaign)
                        }}
                        isDisabled={!canManageCampaigns}
                    >
                        <Trash2 size={16} />
                    </Button>
                </div>
            </CardBody>
        </Card>
    )

    return (
        <div className="space-y-4">
            <div className="hidden lg:block">
                <Table
                    aria-label="Campaign Table"
                    isHeaderSticky
                    classNames={{
                        base: "max-h-[600px]",
                        table: "min-w-[700px]",
                    }}
                    sortDescriptor={{ column: "name", direction: sort === "asc" ? "ascending" : "descending" }}
                    onSortChange={onSortChange}
                >
                    <TableHeader columns={columns}>
                        {(column) => (
                            <TableColumn
                                key={column.uid}
                                align={column.uid === "actions" ? "center" : "start"}
                                allowsSorting={column.uid === "name"}
                            >
                                {column.name}
                            </TableColumn>
                        )}
                    </TableHeader>
                    <TableBody
                        items={sortedCampaigns}
                        isLoading={status === "loading"}
                        loadingContent={<Spinner color="secondary" size="sm" />}
                    >
                        {(item: CampaignWithRelations) => (
                            <TableRow
                                key={rerunId === item.id ? `${item.id}-${rerunStatus}` : item.id}
                                className="hover:bg-default-50/40 transition-colors"
                            >
                                {(columnKey) => (
                                    <TableCell className="py-4">{renderCell(item, columnKey)}</TableCell>
                                )}
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="lg:hidden">
                {sortedCampaigns.map((campaign) => (
                    <MobileCampaignCard key={campaign.id} campaign={campaign} />
                ))}
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center mt-6">
                    <Pagination
                        color="secondary"
                        page={currentPage}
                        total={totalPages}
                        onChange={onPageChange}
                        size={typeof window !== "undefined" && window.innerWidth < 640 ? "sm" : "md"}
                        classNames={{
                            item: "bg-white",
                        }}
                    />
                </div>
            )}

            <CampaignWizardModal
                isOpen={isWizardOpen && Boolean(editingCampaign) && canManageCampaigns}
                onOpenChange={handleWizardOpenChange}
                onClose={handleWizardClose}
                onSubmit={handleEditSubmit}
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
                    <p className="py-4">
                        Are you sure you want to delete <span className="font-semibold">{campaignToDelete.name}</span>?
                    </p>
                ) : null}
                onCancel={() => setCampaignToDelete(null)}
                onConfirm={handleDeleteConfirm}
                confirmText="Delete"
                confirmButtonProps={{ color: "danger" }}
                isConfirmLoading={isDeleteLoading}
            />
        </div>
    )
}