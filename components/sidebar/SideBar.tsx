'use client'
import React from 'react'
import { usePathname } from 'next/navigation'
import { Divider } from '@heroui/react';
import { ChevronsLeft, LayoutDashboard, NotepadTextDashed } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleSidebar } from '@/features/ui/uiSlice';
import Link from 'next/link';
import SidebarNavItem from './SidebarNavItem';
import { SidebarHierarchy } from '@/types/sidebar';

const SideBar = () => {
    const pathname = usePathname();
    const dispatch = useAppDispatch();
    const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
    const noRenderPaths = ['/', '/forgot-password'];

    if (noRenderPaths.includes(pathname)) {
        return null;
    }

    const Navigations: SidebarHierarchy = [
        {
            groupName: 'Overview',
            items: [
                { 
                    name: 'Dashboard', 
                    href: '/dashboard',
                    icon: <LayoutDashboard size={16} />,
                },
            ],
        },
        {
            groupName: 'Content Management',
            items: [
                {
                    name: 'Templates',
                    href: '/templates',
                    icon: <NotepadTextDashed size={16} />,
                }
            ]
        }
    ]

    return (
        <motion.div 
            className={`sticky h-svh border border-l-1 border-default-200 ${sidebarOpen ? 'max-w-[300px]' : 'max-w-[70px]'} w-full flex flex-col transition-all`}
            transition={{
                ease: 'easeInOut',
                duration: 1
            }}
        >
            <div className={`flex ${sidebarOpen ? 'justify-between' : 'justify-center'} p-4 border-b border-default-200`}>
                {
                    sidebarOpen && <Link href={"/"}>
                        <Image
                            src="/images/logos/Big Logo.svg"
                            style={{
                                height: '32px',
                                width: 'auto',
                            }}
                            sizes="100vw"
                            alt="Google Logo"
                            width={157}
                            height={32}
                        />
                    </Link>
                }
                <div
                    className='w-8 h-8 flex justify-center items-center rounded-md border border-default-300 hover:bg-default-200 transition-all transition-duration-200 cursor-pointer'
                    onClick={() => dispatch(toggleSidebar())}
                >
                    <ChevronsLeft size={16}/>
                </div>
            </div>
            <div className="flex flex-col gap-6 p-4">
                {
                    Navigations.map((navGroup, index) => (
                        <React.Fragment key={navGroup.groupName}>
                            <div className="flex flex-col gap-4">
                                {
                                    sidebarOpen && <p className="text-default-400 font-medium text-xs uppercase">{navGroup.groupName}</p>
                                }
                                <div className="flex flex-col gap-2">
                                    {
                                        navGroup.items.map((item) => (
                                            <SidebarNavItem
                                                key={item.name}
                                                href={item.href}
                                                icon={item.icon}
                                                label={item.name}
                                                active={pathname === item.href}
                                                compact={!sidebarOpen}
                                                badgeCount={0}
                                            />
                                        ))
                                    }
                                </div>
                            </div>
                            {
                                index !== Navigations.length - 1 && <Divider key={`divider-${index}`}/>
                            }
                        </React.Fragment>
                    ))
                }
            </div>
        </motion.div>
    )
}

export default SideBar