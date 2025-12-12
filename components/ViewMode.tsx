'use client'
import { Tab, Tabs } from '@heroui/react'
import { LayoutGrid, List } from 'lucide-react';
import React, { useEffect } from 'react'

const ViewMode = () => {
    const [viewMode, setViewMode] = React.useState<string | number>('grid');

    return (
        <Tabs
            selectedKey={viewMode}
            onSelectionChange={setViewMode}
            classNames={{
                tabList: "bg-default-300"
            }}
        >
            <Tab key="grid" title={<LayoutGrid size={16}/>}/>
            <Tab key="list" title={<List size={16}/>}/>
        </Tabs>
    )
}

export default ViewMode