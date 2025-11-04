import { getServerSession } from 'next-auth'
import React from 'react'

const page = async () => {
    const serverSession = await getServerSession();
    console.log('serverSession', serverSession);
    return (
        <div>page</div>
    )
}

export default page