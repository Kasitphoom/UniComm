import Editor from '@/components/Editor'
import TemplateExportBar from '@/components/templates/TemplateExportBar'
import { getTemplateData } from '@/query/templateQuery'
import { redirect } from 'next/navigation'
import React from 'react'
import { getServerSession } from 'next-auth'
import authOptions from '@/lib/auth'

const page = async ({ params }: { params: Promise<{ id: string }> }) => {
    
    const { id } = await params

    if (!id) {
        // navigate back to templates page
        redirect('/templates')
    }

    // Get current session
    const session = await getServerSession(authOptions)
    const currentUserId = (session?.user as any)?.currentBusinessProfile?.id

    // Get template data to check ownership
    const templateData = await getTemplateData(id)
    
    // Check if user is the owner
    const isOwner = templateData?.userId === currentUserId

    return (
        <div className='h-full flex flex-col'>
            {isOwner && <TemplateExportBar id={id} />}
            <Editor id={id} resource='template' hasPermission={isOwner} />
        </div>
    )
}

export default page