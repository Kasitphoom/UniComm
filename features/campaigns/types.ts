import type { CampaignWithRelations } from "@/types/campaign"
import type { FILE_STATUS, SCHEDULE_STATUS } from "@/app/generated/business/prisma"

export type RequestStatus = "idle" | "loading" | "succeeded" | "failed"

export interface CampaignsListState {
    items: CampaignWithRelations[]
    status: RequestStatus
    error: string | null
    query: string
    currentPage: number
    totalPages: number
    totalCount: number
    perPage: number
    statusFilters: FILE_STATUS[]
    scheduleStatusFilters: SCHEDULE_STATUS[]
}

export interface CampaignCreateState {
    status: RequestStatus
    error: string | null
}

export interface CampaignUpdateState {
    status: RequestStatus
    error: string | null
    currentId: string | null
}

export interface CampaignDeleteState {
    status: RequestStatus
    error: string | null
    deletingId: string | null
}

export interface CampaignRerunState {
    status: RequestStatus
    error: string | null
    currentId: string | null
    runningIds: string[]
}

export interface CampaignsState {
    list: CampaignsListState
    create: CampaignCreateState
    update: CampaignUpdateState
    remove: CampaignDeleteState
    rerun: CampaignRerunState
}
