import React from 'react'
import { getBusinessData } from '@/query/businessQuery'
import HeaderUser from './HeaderUser';
import MobileSidebar from '../sidebar/MobileSideBar';

const Header = async () => {
    const business = await getBusinessData();

    return (
        <div className='flex justify-between'>
            <MobileSidebar />
            <div className='flex gap-4 justify-end h-16 border-b border-default-200 items-center px-4 w-full sticky'>
                {business.name}
                <HeaderUser />
            </div>
        </div>
    )
}

export default Header