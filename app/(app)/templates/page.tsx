import React from 'react'
import { Metadata } from 'next'
import TabNavigation from '@/components/templates/TabNavigation'
import ControlBar from '@/components/templates/ControlBar'
import TemplateView from '@/components/templates/TemplateView'

export const metadata: Metadata = {
    title: 'Templates - UniComm',
    description: 'Manage and view your templates in UniComm.',
}

const page = () => {
    return (
        <div className='flex flex-col gap-4 px-6 py-4'>
            <h1 className='font-bold text-xl'>
                Templates
            </h1>
            <TabNavigation />
            <ControlBar />
            <TemplateView userOnly/>
            <TemplateView lable='All Templates'/>
        </div>
    )
}

export default page