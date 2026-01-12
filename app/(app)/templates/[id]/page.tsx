import Editor from '@/components/Editor'
import TemplateExportBar from '@/components/templates/TemplateExportBar'
import { getTemplateData } from '@/query/templateQuery'
import { redirect } from 'next/navigation'
import React from 'react'

const page = async ({ params }: { params: Promise<{ id: string }> }) => {
    
    const { id } = await params

    if (!id) {
        // navigate back to templates page
        redirect('/templates')
    }

    return (
        <div className='h-full flex flex-col'>
            <TemplateExportBar id={id} />
            <Editor id={id} resource='template' />
        </div>
    )
}

export default page