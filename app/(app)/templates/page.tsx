import React from 'react'
import { Metadata } from 'next'
import TabNavigation from '@/components/templates/TabNavigation'
import ControlBar from '@/components/templates/ControlBar'
import TemplateView from '@/components/templates/TemplateView'
import { getTemplateByUserId, getTemplateWithPagination } from '@/query/templateQuery'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const metadata: Metadata = {
    title: 'Templates - UniComm',
    description: 'Manage and view your templates in UniComm.',
}

interface SearchParams {
    query?: string
    page?: string
}

const page = async ({ searchParams }: { searchParams: Promise<SearchParams>}) => {
    const session = await getServerSession(authOptions)
    const userId = (session as any)?.user?.id as string | undefined
    const params = await searchParams
    const templatesByUser = await getTemplateByUserId(userId)
    const templates = await getTemplateWithPagination(params.query || "", params.page ? parseInt(params.page) : 1)

    return (
        <div className='flex flex-col gap-4 px-6 py-4'>
            <h1 className='font-bold text-xl'>
                Templates
            </h1>
            <TabNavigation />
            <ControlBar />
            <TemplateView lists={templatesByUser}/>
            <TemplateView lable='All Templates' lists={templates.templates} currentPage={templates.currentPage} total={templates.total} />
        </div>
    )
}

export default page