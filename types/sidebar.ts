import type { ReactNode } from 'react'

export type SidebarItemBase = {
    name: string
    href: string
    icon: ReactNode
}

// When fetchNotificationHref is present, stateName must also be provided
export type SidebarItemWithNotification = SidebarItemBase & {
    fetchNotificationHref: string
    stateName: string
}

// Item without notifications — explicitly has no stateName/fetchNotificationHref
export type SidebarItemNoNotification = SidebarItemBase & {
    fetchNotificationHref?: undefined
    stateName?: never
}

export type SidebarItem = SidebarItemWithNotification | SidebarItemNoNotification

export type SidebarGroup = {
    groupName: string
    items: SidebarItem[]
}

export type SidebarHierarchy = SidebarGroup[]