export interface BusinessUser {
    id: string
    email: string
    displayName: string
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'AUDITOR'
    createdAt: string
    updatedAt: string
}

export interface UsersState {
    list: {
        items: BusinessUser[]
        status: 'idle' | 'loading' | 'succeeded' | 'failed'
        error: string | null
        currentPage: number
        totalPages: number
        totalCount: number
    }
}
