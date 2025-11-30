"use client"
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit"
import type { ComponentBlocksState } from "./types"
import type {
    ComponentBlockListItem,
    ComponentBlockWithUser,
} from "@/types/componentBlock"
import { Template } from "@pdfme/common"

export const fetchComponentBlocks = createAsyncThunk(
    "componentBlocks/fetchAll",
    async (
        params: {
            query?: string
            page?: number
            perPage?: number
            userOnly?: boolean
        } = {}
    ) => {
        const search = new URLSearchParams()
        if (params.query) search.set("query", params.query)
        if (params.page && params.page > 1)
            search.set("page", String(params.page))
        if (params.perPage) search.set("perPage", String(params.perPage))
        if (params.userOnly) search.set("userOnly", params.userOnly.toString())
        const qs = search.toString()
        const res = await fetch(`/api/components${qs ? `?${qs}` : ""}`, {
            credentials: "include",
        })
        if (!res.ok) {
            const text = await res.text()
            throw new Error(text || "Failed to fetch component blocks")
        }
        const data = (await res.json()) as {
            componentBlocks: ComponentBlockListItem[]
            currentPage: number
            total: number
        }
        return data
    }
)

export const fetchUserComponentBlocks = createAsyncThunk(
    "componentBlocks/fetchUser",
    async (
        params: { query?: string; page?: number; perPage?: number } = {}
    ) => {
        const search = new URLSearchParams()
        search.set("userOnly", "true")
        if (params.query) search.set("query", params.query)
        if (params.page && params.page > 1)
            search.set("page", String(params.page))
        if (params.perPage) search.set("perPage", String(params.perPage))
        const qs = search.toString()
        const res = await fetch(`/api/components${qs ? `?${qs}` : ""}`, {
            credentials: "include",
        })
        if (!res.ok) {
            const text = await res.text()
            throw new Error(text || "Failed to fetch user component blocks")
        }
        const data = (await res.json()) as {
            componentBlocks: ComponentBlockListItem[]
            currentPage: number
            total: number
        }
        return data
    }
)

export const createComponentBlock = createAsyncThunk(
    "componentBlocks/create",
    async (payload: {
        name?: string | undefined;
        paperSize?: "custom" | "a4" | "letter" | "legal" | undefined;
        orientation?: "portrait" | "landscape" | undefined;
        widthCm?: string | undefined;
        heightCm?: string | undefined;
    }) => {
        const res = await fetch("/api/components", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
        })
        if (!res.ok) {
            const text = await res.text()
            throw new Error(text || "Failed to create template")
        }
        const data = (await res.json()) as ComponentBlockWithUser
        return data
    }
)

export const getParsedComponentBlockSchema = createAsyncThunk(
    "components/getParsedComponentschema",
    async (id: string) => {
        const res = await fetch(`/api/components/${id}/parser`, {
            credentials: "include",
        })
        if (!res.ok) {
            const text = await res.text()
            throw new Error(text || "Failed to fetch parsed template schema")
        }
        const data = (await res.json()) as {
            data: Template
        }
        return data.data
    }
)

export const updateComponentBlockTemplate = createAsyncThunk(
    "component/updateComponentBlockTemplate",
    async (params: { id: string; templateData: Template }) => {
        const { id, templateData } = params
        const res = await fetch(`/api/components/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(templateData),
        })
        if (!res.ok) {
            const text = await res.text()
            throw new Error(text || "Failed to update template")
        }
        const data = (await res.json()) as ComponentBlockWithUser
        return data
    }
)

const initialListState = (): ComponentBlocksState["list"] => ({
    items: [],
    status: "idle",
    error: null,
    query: "",
    currentPage: 1,
    totalPages: 0,
    perPage: 8,
})

const initialState: ComponentBlocksState = {
    user: { list: initialListState() },
    list: initialListState(),
    detail: { data: undefined, status: "idle", error: null },
    parsedSchema: { data: undefined, status: "idle", error: null },
}

const componentBlocksSlice = createSlice({
    name: "componentBlocks",
    initialState,
    reducers: {
        setQuery(state, action: PayloadAction<string>) {
            state.list.query = action.payload
            state.list.currentPage = 1
        },
        setPage(state, action: PayloadAction<number>) {
            state.list.currentPage = Math.max(1, action.payload || 1)
        },
        setPerPage(state, action: PayloadAction<number>) {
            state.list.perPage = Math.max(1, action.payload || 8)
        },
        resetList(state) {
            state.list = initialListState()
        },
        resetCreate(state) {
            state.detail.status = "idle"
            state.detail.error = null
            state.detail.data = undefined
        },
        resetParsedComponentBlockSchema(state) {
            state.parsedSchema.status = "idle"
            state.parsedSchema.error = null
            state.parsedSchema.data = undefined
        },
    },
    extraReducers: (builder) => {
        builder
        // Fetch all component blocks
            .addCase(fetchComponentBlocks.pending, (state) => {
                state.list.status = "loading"
                state.list.error = null
            })
            .addCase(fetchComponentBlocks.fulfilled, (state, action) => {
                state.list.status = "succeeded"
                state.list.items = action.payload.componentBlocks
                state.list.currentPage = action.payload.currentPage
                state.list.totalPages = action.payload.total
            })
            .addCase(fetchComponentBlocks.rejected, (state, action) => {
                state.list.status = "failed"
                state.list.error = action.error.message || "Unknown error"
            })

        // Fetch user component blocks
            .addCase(fetchUserComponentBlocks.pending, (state) => {
                state.user.list.status = "loading"
                state.user.list.error = null
            })
            .addCase(fetchUserComponentBlocks.fulfilled, (state, action) => {
                state.user.list.status = "succeeded"
                state.user.list.items = action.payload.componentBlocks
                state.user.list.currentPage = action.payload.currentPage
                state.user.list.totalPages = action.payload.total
            })
            .addCase(fetchUserComponentBlocks.rejected, (state, action) => {
                state.user.list.status = "failed"
                state.user.list.error = action.error.message || "Unknown error"
            })

        // Create component block
            .addCase(createComponentBlock.pending, (state) => {
                state.detail.status = "loading"
                state.detail.error = null
            })
            .addCase(createComponentBlock.fulfilled, (state, action) => {
                state.detail.status = "succeeded"
                state.detail.data = action.payload
                if (state.list.currentPage === 1) {
                    state.list.items = [
                        {
                            id: action.payload.id,
                            name: action.payload.name as string,
                            filePath: action.payload.filePath as string,
                            createdAt: action.payload.createdAt as any,
                            updatedAt: action.payload.updatedAt as any,
                            userId: action.payload.userId as string,
                            user: action.payload.user as any,
                            versions: action.payload.versions as any,
                        },
                        ...state.list.items,
                    ]
                }
            })
            .addCase(createComponentBlock.rejected, (state, action) => {
                state.detail.status = "failed"
                state.detail.error = action.error.message || "Unknown error"
            })

        // Get parsed component block schema
            .addCase(getParsedComponentBlockSchema.pending, (state) => {
                state.parsedSchema.status = "loading"
                state.parsedSchema.error = null
            })
            .addCase(getParsedComponentBlockSchema.fulfilled, (state, action) => {
                state.parsedSchema.status = "succeeded"
                state.parsedSchema.data = action.payload
            })
            .addCase(getParsedComponentBlockSchema.rejected, (state, action) => {
                state.parsedSchema.status = "failed"
                state.parsedSchema.error = action.error.message || "Unknown error"
            })

        // Update component block template
            .addCase(updateComponentBlockTemplate.pending, (state) => {
                state.detail.status = "loading"
                state.detail.error = null
            })
            .addCase(updateComponentBlockTemplate.fulfilled, (state, action) => {
                state.detail.status = "succeeded"
                state.detail.data = action.payload
            })
            .addCase(updateComponentBlockTemplate.rejected, (state, action) => {
                state.detail.status = "failed"
                state.detail.error = action.error.message || "Unknown error"
            })
    },
})

export const { setQuery, setPage, setPerPage, resetList, resetCreate, resetParsedComponentBlockSchema } =
    componentBlocksSlice.actions
export default componentBlocksSlice.reducer
