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

export interface CustomerRecord {
    id: string
    listId: string
    data: any
    createdAt: string | Date
    updatedAt: string | Date
}

export interface ListCustomersState {
    listId: string | null
    contactList: {
        id: string
        name: string
        fields?: any[] | null
        _count?: { customers: number }
    } | null
    items: CustomerRecord[]
    page: number
    pageSize: number
    total: number
    totalPages: number
    status: "idle" | "loading" | "succeeded" | "failed"
    error: string | null
}
