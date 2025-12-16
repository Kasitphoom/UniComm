'use client'
import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { AnimatePresence } from 'framer-motion'
import { SessionProvider } from 'next-auth/react'
import { Provider as ReduxProvider } from 'react-redux'
import { store } from '@/store/store'
import { UserProvider } from '@/components/providers/UserProvider'

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <HeroUIProvider>
            <ToastProvider placement='bottom-right' toastProps={{
                color: "secondary",
                timeout: 2000,
                variant: "flat",
            }}/>
            <SessionProvider>
                <ReduxProvider store={store}>
                    <UserProvider>
                        <AnimatePresence>
                            {children}
                        </AnimatePresence>
                    </UserProvider>
                </ReduxProvider>
            </SessionProvider>
        </HeroUIProvider>
    )
}