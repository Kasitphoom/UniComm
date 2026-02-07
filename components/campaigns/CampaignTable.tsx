"use client"
import { useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
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
} from "@heroui/react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
    fetchCampaigns,
    type FetchCampaignsParams,
} from "@/features/campaigns/campaignsSlice"
import type {
    FILE_STATUS,
    SCHEDULE_STATUS,
} from "@/app/generated/business/prisma"
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
        const perPageParam = params.get("perPage")
        const perPage = perPageParam ? Number(perPageParam) || undefined : undefined

        const fileStatus = params
            .getAll("fileStatus")
            .filter(Boolean) as FILE_STATUS[]
        const scheduleStatus = params
            .getAll("scheduleStatus")
            .filter(Boolean) as SCHEDULE_STATUS[]

        const rawRange = (params.get("range") || "ALL").toUpperCase() as NonNullable<
            FetchCampaignsParams["range"]
        >
        const range = rawRange === "ALL" ? undefined : rawRange
        const startDate = params.get("startDate") || undefined
        const endDate = params.get("endDate") || undefined

        return {
            query,
            page,
            perPage,
            fileStatus: fileStatus.length ? fileStatus : undefined,
            scheduleStatus: scheduleStatus.length ? scheduleStatus : undefined,
            range,
            startDate,
            endDate,
        }
    }, [paramsString])

    useEffect(() => {
        dispatch(fetchCampaigns(campaignParams))
    }, [dispatch, campaignParams])

    const onEdit = (campaign: CampaignWithRelations) => {}

    const onPageChange = (page: number) => {
        const params = new URLSearchParams(searchParams.toString())
        if (page > 1) {
            params.set("page", String(page))
        } else {
            params.delete("page")
        }
        const newSearch = params.toString()
        const url = newSearch ? `?${newSearch}` : ""
        window.history.pushState(null, "", url)
    }

    return (
        <Table
            aria-label="Campaign List"
            removeWrapper
            className="min-w-full"
            classNames={{ th: "bg-default-50 text-default-500", td: "py-4" }}
            bottomContent={
                <div className="flex w-full justify-center">
                    <Pagination
                        color="secondary"
                        page={currentPage}
                        total={totalPages}
                        onChange={onPageChange}
                    />
                </div>
            }
        >
            <TableHeader>
                <TableColumn>CAMPAIGN NAME</TableColumn>
                <TableColumn>TEMPLATES</TableColumn>
                <TableColumn>EXECUTION TIME</TableColumn>
                <TableColumn>RECORDS</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>FILES</TableColumn>
                <TableColumn align="center">ACTIONS</TableColumn>
            </TableHeader>
            <TableBody
                items={campaigns}
                isLoading={status === "loading"}
                emptyContent={
                    status === "loading" ? "" : "No campaigns to display"
                }
                loadingContent={<Spinner color="secondary" label="Loading campaigns..." />}
            >
                {(item: CampaignWithRelations) => (
                    <TableRow
                        key={item.id}
                        className="hover:bg-default-50 transition-colors cursor-pointer"
                        onClick={() => onEdit?.(item)}
                    >
                        <TableCell>
                            <span className="font-bold text-default-700">{item.name}</span>
                        </TableCell>
                        <TableCell>
                            <div className="flex -space-x-2">
                                {item.templates.map((ct) => (
                                    <Tooltip key={ct.id} content={ct.template.title}>
                                        <div className="w-8 h-8 rounded-full bg-secondary-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-secondary">
                                            {ct.template.title.charAt(0)}
                                        </div>
                                    </Tooltip>
                                ))}
                                {item.templates.length > 3 && (
                                    <div className="w-8 h-8 rounded-full bg-default-200 border-2 border-white flex items-center justify-center text-[10px] font-bold">
                                        +{item.templates.length - 3}
                                    </div>
                                )}
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex flex-col">
                                <span className="text-small">
                                    {new Date(item.scheduledAt).toLocaleDateString()}
                                </span>
                                <span className="text-tiny text-default-400">
                                    {new Date(item.scheduledAt).toLocaleTimeString()}
                                </span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <span className="text-small font-medium">
                                {item.totalRecords.toLocaleString()}
                            </span>
                        </TableCell>
                        <TableCell>
                            <StatusCell status={item.scheduleStatus} type="schedule" />
                        </TableCell>
                        <TableCell>
                            <StatusCell status={item.fileStatus} type="file" />
                        </TableCell>
                        <TableCell>
                            <div></div>
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    )
}