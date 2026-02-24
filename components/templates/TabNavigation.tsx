'use client'
import { Tab, Tabs } from '@heroui/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useState } from 'react'

const TabNavigation = () => {
    const router = useRouter();
    const params = useSearchParams();
    const pathname = usePathname();
    const [tabSelected, setTabSelected] = useState<string | number>('pdf');

    useEffect(() => {
        const tab = params.get('tab');
        if (tab) {
            setTabSelected(tab);
        }
    }, []);

    useEffect(() => {
        router.push(`${pathname}?tab=${tabSelected}`);
    }, [tabSelected]);

    return (
        <div className='border-b border-default-300'>
            <Tabs variant='underlined' color='secondary' classNames={{ tabList: "p-0" }} selectedKey={tabSelected} onSelectionChange={setTabSelected}>
                <Tab key="pdf" title="PDF" />
                <Tab key="email" title="Email" isDisabled />
            </Tabs>
        </div>
    )
}

export default TabNavigation