'use client'
import React from 'react'
import { usePathname } from 'next/navigation'
import { Divider } from '@heroui/react';
import { ChevronsLeft, LayoutDashboard, NotepadTextDashed } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';

const SideBar = () => {
    const pathname = usePathname();
    const noRenderPaths = ['/', '/forgot-password'];

    if (noRenderPaths.includes(pathname)) {
        return null;
    }

    const Navigations = [
        {
            groupName: 'Overview',
            items: [
                { 
                    name: 'Dashboard', 
                    href: '/dashboard',
                    icon: <LayoutDashboard size={16} />
                },
            ],
        },
        {
            groupName: 'Content Management',
            items: [
                {
                    name: 'Templates',
                    href: '/templates',
                    icon: <NotepadTextDashed size={16} />
                }
            ]
        }
    ]

    return (
        <motion.div className='sticky h-svh border border-l-1 border-default-200 max-w-[300px] w-full flex flex-col'>
            <div className='flex justify-between px-4 py-6'>
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
                <div className='p-2 rounded-md border border-default-300 hover:bg-default-200 transition-all transition-duration-200 cursor-pointer'>
                    <ChevronsLeft size={16}/>
                </div>
            </div>
            <Divider />
            <div className="flex flex-col gap-6 p-4">
                {
                    Navigations.map((navGroup, index) => (
                        <>
                            <div key={navGroup.groupName} className="flex flex-col gap-4">
                                <p className="text-default-400 font-medium text-xs uppercase">{navGroup.groupName}</p>
                                <div className="flex flex-col gap-2">
                                    {
                                        navGroup.items.map((item) => (
                                            <a
                                                key={item.name}
                                                href={item.href}
                                                className={`
                                                    flex items-center justify-between rounded-md hover:text-secondary-300 transition
                                                    ${pathname === item.href ? 'text-secondary font-medium' : 'text-black'}
                                                `}
                                            >
                                                <div className='flex gap-2 items-center'>
                                                    {item.icon}
                                                    <span>{item.name}</span>
                                                </div>
                                            </a>
                                        ))
                                    }
                                </div>
                            </div>
                            {
                                index !== Navigations.length - 1 && <Divider key={`divider-${index}`}/>
                            }
                        </>
                    ))
                }
            </div>
        </motion.div>
    )
}

export default SideBar