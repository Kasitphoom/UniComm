import ContactListCollection from '@/components/customers/ContactListCollection'
import CustomerListsControlBar from '@/components/customers/ControlBar'
import { Suspense } from 'react'

const page = () => {
    return (
        <Suspense>
            <div className='flex flex-col gap-4 px-6 py-4'>
                <div className='flex flex-col gap-2'>
                    <h1 className='font-bold text-xl'>Customers</h1>
                    <p className="text-default-400 text-small">Your centralized hub for customer data-flexible, searchable, and always synchronised.</p>
                </div>
                <CustomerListsControlBar />
                <ContactListCollection />
            </div>
        </Suspense>
    )
}

export default page