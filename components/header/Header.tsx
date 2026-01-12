import React from 'react'
import { getBusinessData } from '@/query/businessQuery'
import HeaderUser from './HeaderUser';
import MobileSidebar from '../sidebar/MobileSideBar';
import BusinessSelector from './BusinessSelector';

const Header = async () => {
    const business = await getBusinessData();

    return (
        <div className='flex justify-between'>
            <MobileSidebar />
            <div className='flex flex-1 shrink-0 gap-4 justify-end h-16 border-b border-default-200 items-center px-4 w-full sticky'>
                <BusinessSelector businessName={business.name} />
                <HeaderUser />
            </div>
        </div>
    )
}

export default Header