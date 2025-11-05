import type { Template, TemplateListItem } from "@/types/template"

export type RequestStatus = "idle" | "loading" | "succeeded" | "failed"

export interface TemplatesListState {
    items: TemplateListItem[]
    status: RequestStatus
    error: string | null
    query: string
    currentPage: number
    totalPages: number
    perPage: number
}

export interface SingleTemplatesFetchState {
    status: RequestStatus
    error: string | null
    data?: Template
}

export interface TemplatesState {
    list: TemplatesListState
    detail: SingleTemplatesFetchState
}
