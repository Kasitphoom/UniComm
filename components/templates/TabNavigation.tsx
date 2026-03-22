'use client'
import { Tab, Tabs } from '@heroui/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React from 'react'

const TabNavigation = () => {
    const router = useRouter();
    const params = useSearchParams();
    const pathname = usePathname();
    const tabSelected = params.get('tab') ?? 'pdf';

    return (
        <div className='border-b border-default-300'>
            <Tabs
                variant='underlined'
                color='secondary'
                classNames={{ tabList: "p-0" }}
                selectedKey={tabSelected}
                onSelectionChange={(key) => router.push(`${pathname}?tab=${String(key)}`)}
            >
                <Tab key="pdf" title="PDF" />
                <Tab key="email" title="Email" isDisabled />
            </Tabs>
        </div>
    )
}

export default TabNavigation