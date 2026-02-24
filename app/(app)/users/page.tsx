import ControlBar from '@/components/users/ControlBar'
import UserList from '@/components/users/UserList'
import React, { Suspense } from 'react'

const page = () => {
    return (
        <Suspense>
            <div className='flex flex-col gap-4 px-6 py-4'>
                <div className='flex flex-col gap-2'>
                    <h1 className="font-bold text-xl">Team Members</h1>
                    <p className="text-default-400 text-small">Manage your business employees</p>
                </div>
                <ControlBar />
                <UserList />
            </div>
        </Suspense>
    )
}

export default page