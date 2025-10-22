'use client'
import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <HeroUIProvider>
            <ToastProvider placement='bottom-right'/>
            <SessionProvider>
                {children}
            </SessionProvider>
        </HeroUIProvider>
    )
}