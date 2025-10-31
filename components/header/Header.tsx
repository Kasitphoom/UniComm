import React from 'react'
import { getBusinessData } from '@/query/businessQuery'

const Header = async () => {
    const business = await getBusinessData();
    return (
        <div className='flex gap-4 justify-end'>
            {business.name}
        </div>
    )
}

export default Header