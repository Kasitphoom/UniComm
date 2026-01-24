"use client"
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit"
import type { TemplatesState } from "./types"
import type {
    Template,
    TemplateListItem,
    TemplateWithUser,
} from "@/types/template"
import { Template as PDFTemplateType } from "@pdfme/common"

// Thunk: fetch list of templates
export const fetchTemplates = createAsyncThunk(
    "templates/fetchTemplates",
    async (
        params: { query?: string; page?: number; perPage?: number; userOnly?: boolean } = {}
    ) => {
        const search = new URLSearchParams()
        if (params.query) search.set("query", params.query)
        if (params.page && params.page > 1)
            search.set("page", String(params.page))
        if (params.perPage) search.set("perPage", String(params.perPage))
        if (params.userOnly) search.set("userOnly", params.userOnly.toString())
        const qs = search.toString()
        const res = await fetch(`/api/templates${qs ? `?${qs}` : ""}`, {
            credentials: "include",
        })
        if (!res.ok) {
            const text = await res.text()
            throw new Error(text || "Failed to fetch templates")
        }
        const data = (await res.json()) as {
            templates: TemplateListItem[]
            currentPage: number
            total: number
        }
        return data
    }
)

export const fetchUserTemplates = createAsyncThunk(
    "templates/fetchUserTemplates",
    async (params: { query?: string; page?: number; perPage?: number; } = {}) => {
        const search = new URLSearchParams()
        search.set("userOnly", "true")
        if (params.query) search.set("query", params.query)
        if (params.page && params.page > 1)
            search.set("page", String(params.page))
        if (params.perPage) search.set("perPage", String(params.perPage))
        const qs = search.toString()
        const res = await fetch(`/api/templates${qs ? `?${qs}` : ""}`, {
            credentials: "include",
        })
        if (!res.ok) {
            const text = await res.text()
            throw new Error(text || "Failed to fetch user templates")
        }
        const data = (await res.json()) as {
            templates: TemplateListItem[]
            currentPage: number
            total: number
        }
        return data
    }
)


// Thunk: fetch one template by id
export const fetchTemplateById = createAsyncThunk(
    "templates/fetchById",
    async (id: string) => {
        const res = await fetch(`/api/templates/${id}`, {
            credentials: "include",
        })
        if (!res.ok) {
            const text = await res.text()
            throw new Error(text || "Failed to fetch template")
        }
        const data = (await res.json()) as TemplateWithUser
        return data
    }
)

// Thunk: create a new template
export const createTemplate = createAsyncThunk(
    "templates/create",
    async (payload: {
        templateName?: string | undefined;
        paperSize?: "custom" | "a4" | "letter" | "legal" | undefined;
        orientation?: "portrait" | "landscape" | undefined;
        widthCm?: string | undefined;
        heightCm?: string | undefined;
        customerListId?: string | undefined;
    }) => {
        const res = await fetch("/api/templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
        })
        if (!res.ok) {
            const text = await res.text()
            throw new Error(text || "Failed to create template")
        }
        const data = (await res.json()) as TemplateWithUser
        return data
    }
)

export const getParsedTemplateSchema = createAsyncThunk(
    "templates/getParsedTemplateSchema",
    async (id: string) => {
        const res = await fetch(`/api/templates/${id}/parser`, {
            credentials: "include",
        })
        if (!res.ok) {
            const text = await res.text()
            throw new Error(text || "Failed to fetch parsed template schema")
        }
        const data = (await res.json()) as {
            data: any
        }
        return data.data
    }
)

export const deleteTemplate = createAsyncThunk(
    "templates/deleteTemplate",
    async (id: string) => {
        const res = await fetch(`/api/templates/${id}`, {
            method: "DELETE",
            credentials: "include",
        })
        if (!res.ok) {
            const text = await res.text()
            throw new Error(text || "Failed to delete template")
        }
        return id
    }
)

export const updateTemplate = createAsyncThunk(
    "templates/updateTemplate",
    async (params: { id: string; templateData: PDFTemplateType }) => {
        const { id, templateData } = params
        const res = await fetch(`/api/templates/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(templateData),
        })
        if (!res.ok) {
            const text = await res.text()
            throw new Error(text || "Failed to update template")
        }
        const data = (await res.json()) as TemplateWithUser
        return data
    }
)

const initialState: TemplatesState = {
    user: {
        list: {
            items: [],
            status: "idle",
            error: null,
            query: "",
            currentPage: 1,
            totalPages: 0,
            perPage: 8,
        },
    },
    list: {
        items: [],
        status: "idle",
        error: null,
        query: "",
        currentPage: 1,
        totalPages: 0,
        perPage: 8,
    },
    detail: {
        data: undefined,
        status: "idle",
        error: null,
    },
    parsedTemplate: {
        data: null,
        status: "idle",
        error: null,
    },
}

const templatesSlice = createSlice({
    name: "templates",
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
            state.list.items = []
            state.list.status = "idle"
            state.list.error = null
            state.list.query = ""
            state.list.currentPage = 1
            state.list.totalPages = 0
            state.list.perPage = 8
        },
        resetCreate(state) {
            state.detail.status = "idle"
            state.detail.error = null
            state.detail.data = undefined
        },
        resetParsedSchema(state) {
            state.parsedTemplate.status = "idle"
            state.parsedTemplate.error = null
            state.parsedTemplate.data = null
        }
    },
    extraReducers: (builder) => {
        // fetchTemplates
        builder
            .addCase(fetchTemplates.pending, (state) => {
                state.list.status = "loading"
                state.list.error = null
            })
            .addCase(fetchTemplates.fulfilled, (state, action) => {
                state.list.status = "succeeded"
                state.list.items = action.payload.templates
                state.list.currentPage = action.payload.currentPage
                state.list.totalPages = action.payload.total
            })
            .addCase(fetchTemplates.rejected, (state, action) => {
                state.list.status = "failed"
                state.list.error = action.error.message || "Unknown error"
            })
        
        // fetchUserTemplates
        builder
            .addCase(fetchUserTemplates.pending, (state) => {
                state.user.list.status = "loading"
                state.user.list.error = null
            })
            .addCase(fetchUserTemplates.fulfilled, (state, action) => {
                state.user.list.status = "succeeded"
                state.user.list.items = action.payload.templates
                state.user.list.currentPage = action.payload.currentPage
                state.user.list.totalPages = action.payload.total
            })
            .addCase(fetchUserTemplates.rejected, (state, action) => {
                state.user.list.status = "failed"
                state.user.list.error = action.error.message || "Unknown error"
            })

        // fetchTemplateById
        builder
            .addCase(fetchTemplateById.pending, (state) => {
                state.detail.status = "loading"
                state.detail.error = null
            })
            .addCase(fetchTemplateById.fulfilled, (state, action) => {
                state.detail.status = "succeeded"
                state.detail.data = action.payload
            })
            .addCase(fetchTemplateById.rejected, (state, action) => {
                state.detail.status = "failed"
                state.detail.error = action.error.message || "Unknown error"
            })

        // createTemplate
        builder
            .addCase(createTemplate.pending, (state) => {
                state.detail.status = "loading"
                state.detail.error = null
            })
            .addCase(createTemplate.fulfilled, (state, action) => {
                state.detail.status = "succeeded"
                state.detail.data = action.payload
                // Optionally prepend to list when on first page
                if (state.list.currentPage === 1) {
                    state.list.items = [
                        {
                            id: action.payload.id,
                            title: action.payload.title as string,
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
            .addCase(createTemplate.rejected, (state, action) => {
                state.detail.status = "failed"
                state.detail.error = action.error.message || "Unknown error"
            })
        
        // getParsedTemplateSchema
        builder
            .addCase(getParsedTemplateSchema.pending, (state) => {
                state.parsedTemplate.status = "loading"
                state.parsedTemplate.error = null
            })
            .addCase(getParsedTemplateSchema.fulfilled, (state, action) => {
                state.parsedTemplate.status = "succeeded"
                state.parsedTemplate.data = action.payload
            })
            .addCase(getParsedTemplateSchema.rejected, (state, action) => {
                state.parsedTemplate.status = "failed"
                state.parsedTemplate.error = action.error.message || "Unknown error"
            })
        
        // updateTemplate
        builder
            .addCase(updateTemplate.pending, (state) => {
                state.detail.status = "loading"
                state.detail.error = null
            })
            .addCase(updateTemplate.fulfilled, (state, action) => {
                state.detail.status = "succeeded"
                state.detail.data = action.payload
            })
            .addCase(updateTemplate.rejected, (state, action) => {
                state.detail.status = "failed"
                state.detail.error = action.error.message || "Unknown error"
            })
    },
})

export const { setQuery, setPage, setPerPage, resetList, resetCreate, resetParsedSchema } =
    templatesSlice.actions
export default templatesSlice.reducer
