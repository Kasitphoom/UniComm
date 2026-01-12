"use client"
import React from 'react'

interface NotificationBadgeProps {
    count?: number
    max?: number
    className?: string
}

// Small badge that shows a number; hidden when count is 0 or undefined
export default function NotificationBadge({ count, max = 99, className }: NotificationBadgeProps) {
    if (!count || count <= 0) return null
    const display = count > max ? `${max}+` : `${count}`
    return (
        <span
            className={
                `inline-flex items-center justify-center rounded-full bg-danger text-white text-[10px] leading-none px-2 py-1 ${className ?? ''}`
            }
        >
            {display}
        </span>
    )
}
