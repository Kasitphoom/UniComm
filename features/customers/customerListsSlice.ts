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
    async (payload: { name: string; source?: "MANUAL" | "SALESFORCE"; remarks?: string }) => {
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
    async (payload: { name: string; file: File; remarks?: string }) => {
        const formData = new FormData()
        formData.append("name", payload.name)
        formData.append("file", payload.file)
        if (payload.remarks) {
            formData.append("remarks", payload.remarks)
        }

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
    },
})

export const { resetCustomerLists, resetCreateStatus } = customerListsSlice.actions
export default customerListsSlice.reducer
