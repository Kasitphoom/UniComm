"use client"
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { UIState } from './types'

const initialState: UIState = {
  sidebarOpen: true,
  viewMode: 'grid',
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
    setViewMode(state, action: PayloadAction<'grid' | 'list'>) {
      state.viewMode = action.payload
    }
  },
})

export const { toggleSidebar, setSidebarOpen, setViewMode } = uiSlice.actions
export default uiSlice.reducer
