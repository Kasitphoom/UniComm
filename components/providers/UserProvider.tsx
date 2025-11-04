"use client"
import React, { createContext, useContext, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import type { BusinessMembershipDTO } from '@/types/business'

export type UserContextValue = {
    id: string | null
    email: string | null
    name: string | null
    businessIds: string[]
    memberships: BusinessMembershipDTO[]
    activeBusinessId: string | null
    role: string | null
    currentBusinessProfile?: { businessId: string; email: string; displayName: string; role: string } | null
    businessProfiles?: Array<{ businessId: string; email: string; displayName: string; role: string }>
    isAuthenticated: boolean
    loading: boolean
    // Helper to update active business in the JWT/session
    setActiveBusiness: (businessId: string | null) => Promise<void>
}

const UserContext = createContext<UserContextValue | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
    const { data: session, status, update } = useSession()

    const value = useMemo<UserContextValue>(() => {
        const user = session?.user as any | undefined
        const currentProfile = (user?.currentBusinessProfile as any) ?? null
        const activeRole = currentProfile?.role ?? null
        return {
            id: (user?.id as string) ?? null,
            email: (user?.email as string) ?? null,
            name: (user?.name as string) ?? null,
            businessIds: (user?.businessIds as string[]) ?? [],
            memberships: (user?.memberships as BusinessMembershipDTO[]) ?? [],
            activeBusinessId: (user?.activeBusinessId as string) ?? null,
            role: activeRole,
            currentBusinessProfile: currentProfile,
            isAuthenticated: status === 'authenticated',
            loading: status === 'loading',
            setActiveBusiness: async (businessId: string | null) => {
                // Only update when authenticated
                if (status !== 'authenticated') return
                await update({ activeBusinessId: businessId })
            },
        }
    }, [session, status, update])

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser(): UserContextValue {
    const ctx = useContext(UserContext)
    if (!ctx) throw new Error('useUser must be used within a UserProvider')
    return ctx
}
