'use client'
import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { AnimatePresence } from 'framer-motion'
import { SessionProvider } from 'next-auth/react'
import { Provider as ReduxProvider } from 'react-redux'
import { store } from '@/store/store'

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <HeroUIProvider>
            <ToastProvider placement='bottom-right'/>
            <SessionProvider>
                <ReduxProvider store={store}>
                    <AnimatePresence>
                        <div className='flex'>
                            {children}
                        </div>
                    </AnimatePresence>
                </ReduxProvider>
            </SessionProvider>
        </HeroUIProvider>
    )
}