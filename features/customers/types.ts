export type ContactSource = "MANUAL" | "CSV_UPLOAD" | "SALESFORCE"

export interface ContactListDTO {
    id: string
    name: string
    source?: ContactSource | null
    remarks?: string | null
    _count?: {
        customers: number
    }
    createdAt: string
    updatedAt: string
}

export interface CustomerListsState {
    list: {
        items: ContactListDTO[]
        status: "idle" | "loading" | "succeeded" | "failed"
        error: string | null
    }
    create: {
        status: "idle" | "loading" | "succeeded" | "failed"
        error: string | null
    }
}
