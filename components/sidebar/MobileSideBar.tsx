"use client";

import React from "react";
import {
    Navbar,
    NavbarBrand,
    NavbarContent,
    NavbarMenuToggle,
    NavbarMenu,
    NavbarMenuItem,
    Link,
    Button,
} from "@heroui/react";
import { Navigations } from "./SideBar"
import { usePathname } from "next/navigation";

export default function MobileSidebar() {
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);

    // Flatten navigation groups into a single array
    const flattenedMenuItems = Navigations.flatMap((group) => group.items);

    return (
        <Navbar
            onMenuOpenChange={setIsMenuOpen}
            className="md:hidden border-b border-divider" // Only show on mobile/tablet
            isBordered
        >
            <NavbarContent>
                <NavbarMenuToggle
                    aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                    className="sm:hidden"
                />
            </NavbarContent>

            {/* The Sidebar Menu - Only triggers on mobile */}
            <NavbarMenu className="pt-6">
                {flattenedMenuItems.map((item, index) => (
                    <NavbarMenuItem key={`${item.name}-${index}`}>
                        <Link
                            color={
                                pathname.split('/')[1] === item.href.replace('/','') ? "secondary" : "foreground"
                            }
                            className="w-full text-lg py-2"
                            href={item.href}
                            size="lg"
                        >
                            {item.name}
                        </Link>
                    </NavbarMenuItem>
                ))}
            </NavbarMenu>
        </Navbar>
    );
}