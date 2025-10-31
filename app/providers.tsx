'use client'
import { HeroUIProvider, ToastProvider } from '@heroui/react'
import { AnimatePresence } from 'framer-motion'
import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <HeroUIProvider>
            <ToastProvider placement='bottom-right'/>
            <SessionProvider>
                <AnimatePresence>
                    <div className='flex'>
                        {children}
                    </div>
                </AnimatePresence>
            </SessionProvider>
        </HeroUIProvider>
    )
}