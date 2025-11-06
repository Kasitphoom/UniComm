import Editor from '@/components/Editor'
import { redirect } from 'next/navigation'
import React from 'react'

const page = async ({ params }: { params: Promise<{ id: string }> }) => {
    
    const { id } = await params

    if (!id) {
        // navigate back to templates page
        redirect('/templates')
    }

    return (
        <Editor type="pdf" id={id} />
    )
}

export default page