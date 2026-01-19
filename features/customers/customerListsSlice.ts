"use client"
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit"
import type { ContactListDTO, CustomerListsState } from "./types"

// Thunk: fetch all customer/contact lists for the active business
export const fetchCustomerLists = createAsyncThunk(
    "customerLists/fetchAll",
    async () => {
        const res = await fetch("/api/customer-list", {
            credentials: "include",
        })

        if (!res.ok) {
            const text = await res.text()
            throw new Error(text || "Failed to fetch customer lists")
        }

        const data = (await res.json()) as { contactLists: ContactListDTO[] }
        return data.contactLists
    }
)

// Thunk: create customer list with manual entry
export const createCustomerListManual = createAsyncThunk(
    "customerLists/createManual",
    async (payload: { name: string; source?: "MANUAL" | "SALESFORCE"; remarks?: string; upsertMode?: boolean }) => {
        const res = await fetch("/api/customer-list", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(payload),
        })

        if (!res.ok) {
            const errorData = await res.json()
            throw new Error(errorData.error || "Failed to create customer list")
        }

        const data = (await res.json()) as { contactList: ContactListDTO }
        return data.contactList
    }
)

// Thunk: create customer list with CSV upload
export const createCustomerListWithCSV = createAsyncThunk(
    "customerLists/createWithCSV",
    async (payload: { name: string; file: File; remarks?: string; upsertMode?: boolean }) => {
        const formData = new FormData()
        formData.append("name", payload.name)
        formData.append("file", payload.file)
        if (payload.remarks) {
            formData.append("remarks", payload.remarks)
        }
        formData.append("upsertMode", String(payload.upsertMode ?? false))

        const res = await fetch("/api/customer-list", {
            method: "POST",
            credentials: "include",
            body: formData,
        })

        if (!res.ok) {
            const errorData = await res.json()
            throw new Error(errorData.error || "Failed to create customer list")
        }

        const data = (await res.json()) as { contactList: ContactListDTO; recordsCount: number }
        return data.contactList
    }
)

// Thunk: patch customer list
export const patchCustomerList = createAsyncThunk(
    "customerLists/patch",
    async (payload: { id: string; name?: string; remarks?: string; primaryKey?: string, upsertMode?: boolean }) => {
        const res = await fetch(`/api/customer-list/${payload.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                name: payload.name,
                remarks: payload.remarks,
                primaryKey: payload.primaryKey,
                upsertMode: payload.upsertMode,
            }),
        })

        if (!res.ok) {
            const errorData = await res.json()
            throw new Error(errorData.error || "Failed to update customer list")
        }

        const data = (await res.json()) as { contactList: ContactListDTO }
        return data.contactList
    }
)

// Thunk: delete customer list
export const deleteCustomerList = createAsyncThunk(
    "customerLists/delete",
    async (id: string) => {
        const res = await fetch(`/api/customer-list/${id}`, {
            method: "DELETE",
            credentials: "include",
        })

        if (!res.ok) {
            const errorData = await res.json()
            throw new Error(errorData.error || "Failed to delete customer list")
        }

        return id
    }
)

const initialState: CustomerListsState = {
    list: {
        items: [],
        status: "idle",
        error: null,
    },
    create: {
        status: "idle",
        error: null,
    },
    update: {
        status: "idle",
        error: null,
    },
    delete: {
        status: "idle",
        error: null,
    },
}

const customerListsSlice = createSlice({
    name: "customerLists",
    initialState,
    reducers: {
        resetCustomerLists(state) {
            state.list = initialState.list
        },
        resetCreateStatus(state) {
            state.create = initialState.create
        },
        resetUpdateStatus(state) {
            state.update = initialState.update
        },
        resetDeleteStatus(state) {
            state.delete = initialState.delete
        },
    },
    extraReducers: (builder) => {
        builder
            // fetchCustomerLists
            .addCase(fetchCustomerLists.pending, (state) => {
                state.list.status = "loading"
                state.list.error = null
            })
            .addCase(fetchCustomerLists.fulfilled, (state, action) => {
                state.list.status = "succeeded"
                state.list.items = action.payload
            })
            .addCase(fetchCustomerLists.rejected, (state, action) => {
                state.list.status = "failed"
                state.list.error = action.error.message || "Failed to fetch customer lists"
            })
            // createCustomerListManual
            .addCase(createCustomerListManual.pending, (state) => {
                state.create.status = "loading"
                state.create.error = null
            })
            .addCase(createCustomerListManual.fulfilled, (state, action) => {
                state.create.status = "succeeded"
                state.list.items.unshift(action.payload)
            })
            .addCase(createCustomerListManual.rejected, (state, action) => {
                state.create.status = "failed"
                state.create.error = action.error.message || "Failed to create customer list"
            })
            // createCustomerListWithCSV
            .addCase(createCustomerListWithCSV.pending, (state) => {
                state.create.status = "loading"
                state.create.error = null
            })
            .addCase(createCustomerListWithCSV.fulfilled, (state, action) => {
                state.create.status = "succeeded"
                state.list.items.unshift(action.payload)
            })
            .addCase(createCustomerListWithCSV.rejected, (state, action) => {
                state.create.status = "failed"
                state.create.error = action.error.message || "Failed to create customer list"
            })
            // patchCustomerList
            .addCase(patchCustomerList.pending, (state) => {
                state.update.status = "loading"
                state.update.error = null
            })
            .addCase(patchCustomerList.fulfilled, (state, action) => {
                state.update.status = "succeeded"
                const index = state.list.items.findIndex((item) => item.id === action.payload.id)
                if (index !== -1) {
                    state.list.items[index] = action.payload
                }
            })
            .addCase(patchCustomerList.rejected, (state, action) => {
                state.update.status = "failed"
                state.update.error = action.error.message || "Failed to update customer list"
            })
            // deleteCustomerList
            .addCase(deleteCustomerList.pending, (state) => {
                state.delete.status = "loading"
                state.delete.error = null
            })
            .addCase(deleteCustomerList.fulfilled, (state, action) => {
                state.delete.status = "succeeded"
                state.list.items = state.list.items.filter((item) => item.id !== action.payload)
            })
            .addCase(deleteCustomerList.rejected, (state, action) => {
                state.delete.status = "failed"
                state.delete.error = action.error.message || "Failed to delete customer list"
            })
    },
})

export const { resetCustomerLists, resetCreateStatus, resetUpdateStatus, resetDeleteStatus } =
    customerListsSlice.actions
export default customerListsSlice.reducer
