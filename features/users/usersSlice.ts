"use client"
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit"
import type { UsersState, BusinessUser } from "./types"

// Thunk: fetch list of business users
export const fetchUsers = createAsyncThunk(
    "users/fetchUsers",
    async (
        params: { query?: string; page?: number; perPage?: number; sort?: "asc" | "desc" } = {}
    ) => {
        const search = new URLSearchParams()
        if (params.query) search.set("query", params.query)
        if (params.page && params.page > 1)
            search.set("page", String(params.page))
        if (params.perPage) search.set("perPage", String(params.perPage))
        if (params.sort) search.set("sort", params.sort)
        const qs = search.toString()
        const res = await fetch(`/api/business/users${qs ? `?${qs}` : ""}`, {
            credentials: "include",
        })
        if (!res.ok) {
            const text = await res.text()
            throw new Error(text || "Failed to fetch users")
        }
        const data = (await res.json()) as {
            users: BusinessUser[]
            currentPage: number
            totalPages: number
            totalCount: number
        }
        return data
    }
)

// Thunk: update display name and role for a business user
export const updateUser = createAsyncThunk(
    "users/updateUser",
    async ({ id, displayName, role }: { id: string; displayName: string; role: BusinessUser["role"] }) => {
        const res = await fetch(`/api/business/users/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ displayName, role }),
        })

        if (!res.ok) {
            const text = await res.text()
            throw new Error(text || "Failed to update user")
        }

        const data = (await res.json()) as { user: BusinessUser }
        return data.user
    }
)

const initialState: UsersState = {
    list: {
        items: [],
        status: 'idle',
        error: null,
        currentPage: 1,
        totalPages: 0,
        totalCount: 0,
    },
    mutation: {
        updateStatus: 'idle',
        updateError: null,
        updatingId: null,
    },
}

const usersSlice = createSlice({
    name: "users",
    initialState,
    reducers: {
        clearUsers: (state) => {
            state.list = initialState.list
        },
    },
    extraReducers: (builder) => {
        builder
            // fetchUsers
            .addCase(fetchUsers.pending, (state) => {
                state.list.status = 'loading'
                state.list.error = null
            })
            .addCase(fetchUsers.fulfilled, (state, action) => {
                state.list.status = 'succeeded'
                state.list.items = action.payload.users
                state.list.currentPage = action.payload.currentPage
                state.list.totalPages = action.payload.totalPages
                state.list.totalCount = action.payload.totalCount
            })
            .addCase(fetchUsers.rejected, (state, action) => {
                state.list.status = 'failed'
                state.list.error = action.error.message || 'Failed to fetch users'
            })
            // updateUser
            .addCase(updateUser.pending, (state, action) => {
                state.mutation.updateStatus = 'loading'
                state.mutation.updateError = null
                state.mutation.updatingId = action.meta.arg.id
            })
            .addCase(updateUser.fulfilled, (state, action) => {
                state.mutation.updateStatus = 'succeeded'
                state.mutation.updatingId = null

                const updated = action.payload
                const index = state.list.items.findIndex((user) => user.id === updated.id)
                if (index !== -1) {
                    state.list.items[index] = updated
                }
            })
            .addCase(updateUser.rejected, (state, action) => {
                state.mutation.updateStatus = 'failed'
                state.mutation.updateError = action.error.message || 'Failed to update user'
                state.mutation.updatingId = null
            })
    },
})

export const { clearUsers } = usersSlice.actions
export default usersSlice.reducer
