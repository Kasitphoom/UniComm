"use client"
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { UIState } from './types'

const initialState: UIState = {
  sidebarOpen: true,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload
    },
  },
})

export const { toggleSidebar, setSidebarOpen } = uiSlice.actions
export default uiSlice.reducer
