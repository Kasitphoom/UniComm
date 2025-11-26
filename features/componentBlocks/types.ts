import type { ComponentBlockListItem, ComponentBlockWithUser } from '@/types/componentBlock'

export interface ComponentBlocksListState {
  items: ComponentBlockListItem[]
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: string | null
  query: string
  currentPage: number
  totalPages: number
  perPage: number
}

export interface ComponentBlockDetailState {
  data: ComponentBlockWithUser | undefined
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: string | null
}

export interface ComponentBlocksState {
  user: {
    list: ComponentBlocksListState
  }
  list: ComponentBlocksListState
  detail: ComponentBlockDetailState
}
