"use client"
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit"
import type { CampaignsState } from "./types"
import type {
    FILE_STATUS,
    SCHEDULE_STATUS,
} from "@/app/generated/business/prisma"
import type { CampaignListResponse, CampaignWithRelations } from "@/types/campaign"

export type FetchCampaignsParams = {
    query?: string
    page?: number
    perPage?: number
    fileStatus?: FILE_STATUS[]
    scheduleStatus?: SCHEDULE_STATUS[]
    range?: "ALL" | "TODAY" | "LAST_7_DAYS" | "THIS_MONTH" | "CUSTOM"
    startDate?: string
    endDate?: string
}

export const fetchCampaigns = createAsyncThunk(
    "campaigns/fetchCampaigns",
    async (params: FetchCampaignsParams = {}) => {
        const search = new URLSearchParams()

        if (params.query) search.set("query", params.query)
        if (params.page && params.page > 1)
            search.set("page", String(params.page))
        if (params.perPage) search.set("perPage", String(params.perPage))
        params.fileStatus?.forEach((status) =>
            search.append("fileStatus", status),
        )
        params.scheduleStatus?.forEach((status) =>
            search.append("scheduleStatus", status),
        )
        if (params.range && params.range !== "ALL") {
            search.set("range", params.range)
        }
        if (params.startDate) search.set("startDate", params.startDate)
        if (params.endDate) search.set("endDate", params.endDate)

        const qs = search.toString()
        const res = await fetch(`/api/campaigns${qs ? `?${qs}` : ""}`, {
            credentials: "include",
        })
        if (!res.ok) {
            const text = await res.text()
            throw new Error(text || "Failed to fetch campaigns")
        }
        const data = (await res.json()) as CampaignListResponse
        return data
    },
)

export type CreateCampaignPayload = {
    name: string
    scheduledAt: string
    templateId: string
    customerListId: string
}

export const createCampaign = createAsyncThunk(
    "campaigns/createCampaign",
    async (payload: CreateCampaignPayload) => {
        const response = await fetch("/api/campaigns", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                name: payload.name.trim(),
                scheduledAt: payload.scheduledAt,
                templateIds: [payload.templateId],
                customerListId: payload.customerListId,
            }),
        })

        let data: unknown = null
        try {
            data = await response.json()
        } catch (error) {
            // Ignore JSON parsing errors and fall back to generic messaging
        }

        if (!response.ok || !data) {
            const errorMessage =
                data &&
                typeof data === "object" &&
                data !== null &&
                "error" in data &&
                typeof (data as { error?: unknown }).error === "string"
                    ? ((data as { error?: string }).error as string)
                    : "Failed to create campaign"
            throw new Error(errorMessage)
        }

        return data as CampaignWithRelations
    },
)

const initialState: CampaignsState = {
    list: {
        items: [],
        status: "idle",
        error: null,
        query: "",
        currentPage: 1,
        totalPages: 0,
        totalCount: 0,
        perPage: 10,
        statusFilters: [],
        scheduleStatusFilters: [],
    },
    create: {
        status: "idle",
        error: null,
    },
}

const campaignsSlice = createSlice({
    name: "campaigns",
    initialState,
    reducers: {
        setCampaignQuery(state, action: PayloadAction<string>) {
            state.list.query = action.payload
            state.list.currentPage = 1
        },
        setCampaignPage(state, action: PayloadAction<number>) {
            state.list.currentPage = Math.max(1, action.payload || 1)
        },
        setCampaignPerPage(state, action: PayloadAction<number>) {
            state.list.perPage = Math.max(1, action.payload || 1)
        },
        setCampaignStatusFilters(state, action: PayloadAction<FILE_STATUS[]>) {
            state.list.statusFilters = action.payload
            state.list.currentPage = 1
        },
        setCampaignScheduleStatusFilters(
            state,
            action: PayloadAction<SCHEDULE_STATUS[]>,
        ) {
            state.list.scheduleStatusFilters = action.payload
            state.list.currentPage = 1
        },
        resetCampaigns(state) {
            state.list = {
                ...initialState.list,
            }
            state.create = {
                ...initialState.create,
            }
        },
        resetCreateCampaign(state) {
            state.create = {
                ...initialState.create,
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchCampaigns.pending, (state) => {
                state.list.status = "loading"
                state.list.error = null
            })
            .addCase(fetchCampaigns.fulfilled, (state, action) => {
                state.list.status = "succeeded"
                state.list.items = action.payload.campaigns
                state.list.currentPage = action.payload.currentPage
                state.list.totalPages = action.payload.totalPages
                state.list.totalCount = action.payload.totalCount
            })
            .addCase(fetchCampaigns.rejected, (state, action) => {
                state.list.status = "failed"
                state.list.error = action.error.message || "Unknown error"
            })
            .addCase(createCampaign.pending, (state) => {
                state.create.status = "loading"
                state.create.error = null
            })
            .addCase(createCampaign.fulfilled, (state, action) => {
                state.create.status = "succeeded"
                state.list.items.unshift(action.payload)
                state.list.totalCount += 1
            })
            .addCase(createCampaign.rejected, (state, action) => {
                state.create.status = "failed"
                state.create.error = action.error.message || "Failed to create campaign"
            })
    },
})

export const {
    setCampaignQuery,
    setCampaignPage,
    setCampaignPerPage,
    setCampaignStatusFilters,
    setCampaignScheduleStatusFilters,
    resetCampaigns,
    resetCreateCampaign,
} = campaignsSlice.actions

export default campaignsSlice.reducer
