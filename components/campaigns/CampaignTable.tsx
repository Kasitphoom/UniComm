"use client"

import { useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import {
    Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
    Tooltip, Spinner, Pagination, Button,
    PressEvent
} from "@heroui/react"
import { Edit2, Trash2, Play, MoreVertical } from "lucide-react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { fetchCampaigns, type FetchCampaignsParams } from "@/features/campaigns/campaignsSlice"
import type { FILE_STATUS, SCHEDULE_STATUS } from "@/app/generated/business/prisma"
import { StatusCell } from "./StatusCell"
import { CampaignWithRelations } from "@/types/campaign"

export const CampaignTable = () => {
    const dispatch = useAppDispatch()
    const searchParams = useSearchParams()
    const { items: campaigns, status, totalPages, currentPage } = useAppSelector(
        (state) => state.campaigns.list,
    )

    const paramsString = searchParams.toString()

    const campaignParams = useMemo<FetchCampaignsParams>(() => {
        const params = new URLSearchParams(paramsString)
        const query = params.get("query") || undefined
        const page = Math.max(1, Number(params.get("page")) || 1)
        const perPage = Number(params.get("perPage")) || 10

        return {
            query,
            page,
            perPage,
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

    // Action Handlers
    const handleAction = (e: PressEvent, type: string, campaign: CampaignWithRelations) => {
        console.log(`${type} campaign:`, campaign.id);
    }

    return (
        <Table
            aria-label="Campaign List"
            removeWrapper
            classNames={{
                base: "max-w-full overflow-x-auto",
                th: "bg-transparent text-default-400 font-bold text-tiny border-b border-default-100",
                td: "py-3 border-b border-default-50 last:border-none",
            }}
            bottomContent={
                <div className="flex w-full justify-center py-4">
                    <Pagination
                        isCompact
                        showControls
                        color="secondary"
                        page={currentPage}
                        total={totalPages}
                        onChange={(page) => window.history.pushState(null, "", `?page=${page}`)}
                    />
                </div>
            }
        >
            <TableHeader>
                <TableColumn>CAMPAIGN</TableColumn>
                <TableColumn>TEMPLATES</TableColumn>
                <TableColumn>SCHEDULED</TableColumn>
                <TableColumn>RECORDS</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>FILES</TableColumn>
                <TableColumn align="center">ACTIONS</TableColumn>
            </TableHeader>
            <TableBody
                items={campaigns}
                isLoading={status === "loading"}
                loadingContent={<Spinner color="secondary" size="sm" />}
            >
                {(item) => (
                    <TableRow 
                        key={item.id} 
                        className="hover:bg-default-50/50 transition-colors cursor-pointer group"
                        onClick={() => console.log("Edit row", item.id)}
                    >
                        <TableCell>
                            <span className="text-small font-bold text-default-700">{item.name}</span>
                        </TableCell>
                        <TableCell>
                            <div className="flex -space-x-1.5">
                                {item.templates.slice(0, 3).map((ct) => (
                                    <Tooltip key={ct.id} content={ct.template.title}>
                                        <div className="w-7 h-7 rounded-full bg-secondary-50 border-2 border-white flex items-center justify-center text-[10px] font-bold text-secondary-400">
                                            {ct.template.title.charAt(0)}
                                        </div>
                                    </Tooltip>
                                ))}
                                {item.templates.length > 3 && (
                                    <div className="w-7 h-7 rounded-full bg-default-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-default-500">
                                        +{item.templates.length - 3}
                                    </div>
                                )}
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex flex-col text-tiny">
                                <span className="font-medium">{new Date(item.scheduledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                <span className="text-default-400">{new Date(item.scheduledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <span className="text-tiny font-mono text-default-500">{item.totalRecords.toLocaleString()}</span>
                        </TableCell>
                        <TableCell><StatusCell status={item.scheduleStatus} type="schedule" /></TableCell>
                        <TableCell><StatusCell status={item.fileStatus} type="file" /></TableCell>
                        <TableCell>
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Tooltip content="Re-trigger" size="sm" color="secondary">
                                    <Button isIconOnly size="sm" variant="light" color="secondary" onPress={(e) => handleAction(e, 'retrigger', item)}>
                                        <Play size={14} fill="currentColor" />
                                    </Button>
                                </Tooltip>
                                <Tooltip content="Edit" size="sm">
                                    <Button isIconOnly size="sm" variant="light" className="text-default-400" onPress={(e) => handleAction(e, 'edit', item)}>
                                        <Edit2 size={14} />
                                    </Button>
                                </Tooltip>
                                <Tooltip content="Delete" size="sm" color="danger">
                                    <Button isIconOnly size="sm" variant="light" color="danger" onPress={(e) => handleAction(e, 'delete', item)}>
                                        <Trash2 size={14} />
                                    </Button>
                                </Tooltip>
                            </div>
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    )
}