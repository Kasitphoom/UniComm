"use client"
import Link from 'next/link'
import React from 'react'
import NotificationBadge from './NotificationBadge'
import { motion } from 'motion/react'

interface SidebarNavItemProps {
    href: string
    icon: React.ReactNode
    label: string
    active?: boolean
    compact?: boolean
    badgeCount?: number
}

export default function SidebarNavItem({ href, icon, label, active, compact, badgeCount }: SidebarNavItemProps) {
    if (compact) {
        // Compact
        return (
            <Link
                href={href}
                className={`rounded-md transition hover:text-secondary-300 flex flex-col justify-center items-center gap-[10px] px-2 py-1 ${active ? 'text-secondary font-medium' : 'text-black'}`}
            >
                <div className="flex items-center justify-center">{icon}</div>
                <NotificationBadge count={badgeCount} />
            </Link>
        )
    }

    // Expanded
    return (
        <Link
            href={href}
            className={`flex items-center justify-between rounded-md hover:text-secondary-300 transition ${active ? 'text-secondary font-medium' : 'text-black'}`}
        >
            <div className="flex gap-2 items-center overflow-hidden">
                {icon}
                <motion.span
                    initial={{ opacity: 0, clipPath: 'inset(0% 100% 0% 0%)' }}
                    animate={{ opacity: 1, clipPath: 'inset(0% 0% 0% 0%)' }}
                    exit={{ opacity: 0, clipPath: 'inset(0% 100% 0% 0%)' }}
                    transition={{ duration: 0.3, delay: 0.1, ease: 'easeInOut' }}
                    className="inline-block"
                >
                    {label}
                </motion.span>
            </div>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2, ease: 'easeInOut' }}
            >
                <NotificationBadge count={badgeCount} />
            </motion.div>
        </Link>
    )
}
