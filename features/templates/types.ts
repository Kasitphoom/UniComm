import type { TemplateWithUser, TemplateListItem } from "@/types/template"
import { Template as PDFTemplate } from "@pdfme/common"
import { Schema } from "@pdfme/common"

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
    data?: TemplateWithUser | null
}

export interface ParsedTemplateFetchState {
    status: RequestStatus
    error: string | null
    data?: PDFTemplate | null
}

export interface TemplatesState {
    list: TemplatesListState
    detail: SingleTemplatesFetchState
    parsedTemplate: ParsedTemplateFetchState
    user: {
        list: TemplatesListState
    }
}