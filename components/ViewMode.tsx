'use client'
import { Tab, Tabs } from '@heroui/react'
import { LayoutGrid, List } from 'lucide-react';
import React, { useEffect } from 'react';
import { setViewMode as setReduxViewMode } from '@/features/ui/uiSlice';
import { useAppDispatch } from '@/store/hooks';

const ViewMode = () => {
    const dispatch = useAppDispatch();
    const [viewMode, setViewMode] = React.useState<string | number>('grid');

    useEffect(() => {
        dispatch(setReduxViewMode(viewMode as 'grid' | 'list'));
    }, [viewMode, dispatch]);

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