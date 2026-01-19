import Editor from '@/components/Editor'
import { componentBlockAdapter } from '@/lib/editor/adapter'
import { getComponentBlockData } from '@/query/templateQuery'
import { redirect } from 'next/navigation'
import React from 'react'
import { getServerSession } from 'next-auth'
import authOptions from '@/lib/auth'

const page = async ({ params }: { params: Promise<{ id: string }> }) => {
    
    const { id } = await params

    if (!id) {
        // navigate back to templates page
        redirect('/components')
    }

    // Get current session
    const session = await getServerSession(authOptions)
    const currentUserId = (session?.user as any)?.currentBusinessProfile?.id

    // Get component block data to check ownership
    const componentBlockData = await getComponentBlockData(id)
    
    // Check if user is the owner
    const isOwner = componentBlockData?.userId === currentUserId

    return (
        <div className='h-full'>
            <Editor id={id} resource='component' draftKeyPrefix='components' hasPermission={isOwner} />
        </div>
    )
}

export default page