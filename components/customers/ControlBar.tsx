'use client'
import React, { useState } from 'react'
import ViewMode from '../ViewMode'
import SearchBar from '../SearchBar'
import { Button, ButtonGroup, Dropdown, DropdownMenu, DropdownTrigger, DropdownItem } from '@heroui/react'
import { ChevronDown, Layers, ListPlus } from 'lucide-react'
import { useUser } from '@/components/providers/UserProvider'
import { canCreateResource } from '@/utils/permissions'
import CreateCustomerListModal from './CreateCustomerListModal'
import { useAppDispatch } from '@/store/hooks'
import { fetchCustomerLists } from '@/features/customers/customerListsSlice'

const CustomerListsControlBar = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const currentUser = useUser();
    const canCreate = canCreateResource(currentUser.role);
    const dispatch = useAppDispatch();

    const handleSuccess = () => {
        // Refresh the customer lists after successful creation
        dispatch(fetchCustomerLists());
    };

    return (
        <>
            <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-end'>
                <Button 
                    color='secondary' 
                    className='w-full md:w-auto' 
                    startContent={<ListPlus size={16} />} 
                    onPress={() => setIsModalOpen(true)}
                    isDisabled={!canCreate}
                >
                    New Customer List
                </Button>
            </div>

            <CreateCustomerListModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleSuccess}
            />
        </>
    )
}

export default CustomerListsControlBar