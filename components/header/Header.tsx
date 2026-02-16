import React from 'react'
import { getBusinessData } from '@/query/businessQuery'
import HeaderUser from './HeaderUser';
import MobileSidebar from '../sidebar/MobileSideBar';
import BusinessSelector from './BusinessSelector';
import HeaderBreadcrumbs from './HeaderBreadcrumbs';

const Header = async () => {
    const business = await getBusinessData();

    return (
        <div className='flex h-16 w-full items-center border-b border-default-200 px-4 sticky top-0 bg-background z-10'>
            <div className='flex flex-1 items-center gap-3 min-w-0'>
                <div className="shrink-0">
                    <MobileSidebar />
                </div>
                <HeaderBreadcrumbs />
            </div>
            <div className='flex items-center gap-4'>
                <BusinessSelector businessName={business.name} />
                <HeaderUser />
            </div>
        </div>
    )
}

export default Header