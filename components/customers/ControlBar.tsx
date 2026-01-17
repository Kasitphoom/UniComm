'use client'
import React, { useState } from 'react'
import ViewMode from '../ViewMode'
import SearchBar from '../SearchBar'
import { Button, ButtonGroup, Dropdown, DropdownMenu, DropdownTrigger, DropdownItem } from '@heroui/react'
import { ChevronDown, Layers, ListPlus } from 'lucide-react'
import { useUser } from '@/components/providers/UserProvider'
import { canCreateResource } from '@/utils/permissions'

const CustomerListsControlBar = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const currentUser = useUser();
    const canCreate = canCreateResource(currentUser.role);

    return (
        <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-end'>
            <div className='flex items-center gap-2'>
                <SearchBar props={{
                    classNames: {
                        base: 'max-w-none! md:max-w-[300px]',
                    }
                }} />
            </div>
            <Button color='secondary' className='w-full md:w-auto' startContent={<ListPlus size={16} />} onPress={() => setIsModalOpen(true)}>New Customer List</Button>
        </div>
    )
}

export default CustomerListsControlBar