import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import TabNavigation from '@/components/templates/TabNavigation'
import ComponentBlocksControlBar from '@/components/componentBlocks/ComponentBlocksControlBar'
import ComponentBlocksView from '@/components/componentBlocks/ComponentBlocksView'

export const metadata: Metadata = {
    title: 'Component Blocks - UniComm',
    description: 'Manage and view reusable component blocks.',
}

const ComponentsPage = () => {
    return (
        <Suspense fallback={<div className='p-6'>Loading components...</div>}>
            <div className='flex flex-col gap-4 px-6 py-4'>
                <h1 className='font-bold text-xl'>Component Blocks</h1>
                <TabNavigation />
                <ComponentBlocksControlBar />
                <ComponentBlocksView />
            </div>
        </Suspense>
    )
}

export default ComponentsPage