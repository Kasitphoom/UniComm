"use client"
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit"
import type { ListCustomersState, CustomerRecord, ContactListDTO } from "./types"

export const fetchListCustomers = createAsyncThunk(
  "listCustomers/fetch",
  async (payload: { id: string; page?: number; pageSize?: number; query?: string }) => {
    const { id, page = 1, pageSize = 20, query } = payload
    const qs = new URLSearchParams()
    qs.set("page", String(page))
    qs.set("pageSize", String(pageSize))
    if (query && query.trim()) qs.set("q", query.trim())

    const res = await fetch(`/api/customer-list/${id}?${qs.toString()}`, {
      credentials: "include",
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || "Failed to fetch customers")
    }

    const data = (await res.json()) as {
      contactList: ContactListDTO
      customers: { items: CustomerRecord[]; page: number; pageSize: number; total: number; totalPages: number }
    }

    return { id, ...data }
  }
)

export const deleteCustomers = createAsyncThunk(
  "listCustomers/delete",
  async (payload: { listId: string; ids: string[] }) => {
    const { listId, ids } = payload

    const res = await fetch(`/api/customer-list/${listId}/customer`, {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || "Failed to delete customers")
    }

    return { ids }
  }
)

export const updateCustomer = createAsyncThunk(
  "listCustomers/update",
  async (payload: { listId: string; customerId: string; data: Record<string, any> }) => {
    const { listId, customerId, data } = payload

    const res = await fetch(`/api/customer-list/${listId}/customer/${customerId}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || "Failed to update customer")
    }

    const result = await res.json()
    return result.customer as CustomerRecord
  }
)

const initialState: ListCustomersState = {
  listId: null,
  contactList: null,
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
  status: "idle",
  error: null,
}

const listCustomersSlice = createSlice({
  name: "listCustomers",
  initialState,
  reducers: {
    resetListCustomers(state) {
      Object.assign(state, initialState)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchListCustomers.pending, (state) => {
        state.status = "loading"
        state.error = null
      })
      .addCase(fetchListCustomers.fulfilled, (state, action) => {
        state.status = "succeeded"
        state.listId = action.payload.id
        state.contactList = action.payload.contactList
        state.items = action.payload.customers.items
        state.page = action.payload.customers.page
        state.pageSize = action.payload.customers.pageSize
        state.total = action.payload.customers.total
        state.totalPages = action.payload.customers.totalPages
      })
      .addCase(fetchListCustomers.rejected, (state, action) => {
        state.status = "failed"
        state.error = action.error.message || "Failed to fetch customers"
      })
      .addCase(deleteCustomers.pending, (state) => {
        state.status = "loading"
        state.error = null
      })
      .addCase(deleteCustomers.fulfilled, (state, action) => {
        state.status = "succeeded"
        state.items = state.items.filter((item) => !action.payload.ids.includes(item.id))
        state.total = Math.max(0, state.total - action.payload.ids.length)
      })
      .addCase(deleteCustomers.rejected, (state, action) => {
        state.status = "failed"
        state.error = action.error.message || "Failed to delete customers"
      })
      .addCase(updateCustomer.pending, (state) => {
        state.status = "loading"
        state.error = null
      })
      .addCase(updateCustomer.fulfilled, (state, action) => {
        state.status = "succeeded"
        const index = state.items.findIndex((item) => item.id === action.payload.id)
        if (index !== -1) {
          state.items[index] = action.payload
        }
      })
      .addCase(updateCustomer.rejected, (state, action) => {
        state.status = "failed"
        state.error = action.error.message || "Failed to update customer"
      })
  },
})

export const { resetListCustomers } = listCustomersSlice.actions
export default listCustomersSlice.reducer
