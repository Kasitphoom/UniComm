"use client"
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit"
import type { UsersState, BusinessUser } from "./types"

// Thunk: fetch list of business users
export const fetchUsers = createAsyncThunk(
    "users/fetchUsers",
    async (
        params: { query?: string; page?: number; perPage?: number } = {}
    ) => {
        const search = new URLSearchParams()
        if (params.query) search.set("query", params.query)
        if (params.page && params.page > 1)
            search.set("page", String(params.page))
        if (params.perPage) search.set("perPage", String(params.perPage))
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

const initialState: UsersState = {
    list: {
        items: [],
        status: 'idle',
        error: null,
        currentPage: 1,
        totalPages: 0,
        totalCount: 0,
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
    },
})

export const { clearUsers } = usersSlice.actions
export default usersSlice.reducer
