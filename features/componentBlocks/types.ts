import type {
    ComponentBlockListItem,
    ComponentBlockWithUser,
} from "@/types/componentBlock"
import { Template } from "@pdfme/common"

export type RequestStatus = "idle" | "loading" | "succeeded" | "failed"

export interface ComponentBlocksListState {
    items: ComponentBlockListItem[]
    status: RequestStatus
    error: string | null
    query: string
    currentPage: number
    totalPages: number
    perPage: number
}

export interface ComponentBlockDetailState {
    data: ComponentBlockWithUser | undefined
    status: RequestStatus
    error: string | null
}

export interface ParsedComponentBlockSchema {
    status: RequestStatus
    error: string | null
    data?: Template | null
}

export interface ComponentBlocksState {
    user: {
        list: ComponentBlocksListState
    }
    list: ComponentBlocksListState
    detail: ComponentBlockDetailState
    parsedSchema: {
        data: any | undefined
        status: "idle" | "loading" | "succeeded" | "failed"
        error: string | null
    }
}
