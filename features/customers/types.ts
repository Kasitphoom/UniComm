export type ContactSource = "MANUAL" | "CSV_UPLOAD" | "SALESFORCE"
type Status = "idle" | "loading" | "succeeded" | "failed"

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
        status: Status
        error: string | null
    }
    create: {
        status: Status
        error: string | null
    }
    update: {
        status: Status
        error: string | null
    }
    delete: {
        status: Status
        error: string | null
    }
}
