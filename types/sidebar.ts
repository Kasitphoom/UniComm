export type SidebarHierarchy = {
    groupName: string;
    items: {
        name: string;
        href: string;
        icon: React.JSX.Element;
        fetchNotificationHref?: string;
    }[];
}[];