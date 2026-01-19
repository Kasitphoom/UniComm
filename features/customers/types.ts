import type { ContactList, Customer } from "@/app/generated/business/prisma"

export type ContactSource = "MANUAL" | "CSV_UPLOAD" | "SALESFORCE"
type Status = "idle" | "loading" | "succeeded" | "failed"

export type ContactListDTO = ContactList & {
    _count?: {
        customers: number
    }
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

export type CustomerRecord = Customer

export type ListCustomerPureState = {
    items: CustomerRecord[]
    page: number
    pageSize: number
    total: number
    totalPages: number
    status: Status
    error: string | null
}

export interface ListCustomersState {
    listId: string | null
    contactList: ContactListDTO | null
    items: CustomerRecord[]
    page: number
    pageSize: number
    total: number
    totalPages: number
    status: "idle" | "loading" | "succeeded" | "failed"
    error: string | null
}
