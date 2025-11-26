import Editor from '@/components/Editor'
import { getTemplateData } from '@/query/templateQuery'
import { redirect } from 'next/navigation'
import React from 'react'

const page = async ({ params }: { params: Promise<{ id: string }> }) => {
    
    const { id } = await params

    if (!id) {
        // navigate back to templates page
        redirect('/components')
    }

    return (
        <div className='h-full'>
            <Editor type="pdf" id={id} />
        </div>
    )
}

export default page