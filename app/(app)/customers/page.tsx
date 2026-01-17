import CustomerListsControlBar from '@/components/customers/ControlBar'
import { Suspense } from 'react'

const page = () => {
    return (
        <Suspense>
            <div className='flex flex-col gap-4 px-6 py-4'>
                <h1 className='font-bold text-xl'>Customers</h1>
                <CustomerListsControlBar />
            </div>
        </Suspense>
    )
}

export default page