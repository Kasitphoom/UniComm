import { redirect } from 'next/navigation'
import React from 'react'

const page = async ({ params }: { params: { id: string } }) => {
    
    const id = params.id

    if (!id) {
        // navigate back to templates page
        redirect('/templates')
    }

    return (
        <div>Editing on template id:{id}</div>
    )
}

export default page