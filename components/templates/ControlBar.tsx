'use client'
import React, { useState } from 'react'
import ViewMode from '../ViewMode'
import SearchBar from '../SearchBar'
import { Button, ButtonGroup, Dropdown, DropdownMenu, DropdownTrigger, DropdownItem } from '@heroui/react'
import { ChevronDown, FilePlusCorner } from 'lucide-react'
import CreateTemplateModal from './CreateTemplateModal'
import { useUser } from '@/components/providers/UserProvider'
import { canCreateResource, userHasPermissionClient } from '@/utils/permissions'
import { UserRole } from '@/app/generated/business/prisma'

const ControlBar = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const currentUser = useUser();
    const canCreatePermission = userHasPermissionClient([ UserRole.OWNER, UserRole.ADMIN, UserRole.MEMBER ]);

    return (
        <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-end'>
            <div className='flex items-center gap-4'>
                <ViewMode />
                <SearchBar />
            </div>
            <ButtonGroup className='rounded-xl overflow-hidden' isDisabled={!canCreatePermission}>
                <Button className='w-full' color='secondary' startContent={<FilePlusCorner size={16} />} onPress={() => setIsModalOpen(true)}>New Template</Button>
                <Dropdown placement='bottom-end'>
                    <DropdownTrigger className='min-w-0'>
                        <Button color='secondary'><ChevronDown size={16}/></Button>
                    </DropdownTrigger>
                    <DropdownMenu
                        disallowEmptySelection
                        aria-label="Create template options"
                        selectionMode="single"
                    >
                        <DropdownItem key="import" description="Import a template created from UniComm">
                            Import Template
                        </DropdownItem>
                    </DropdownMenu>
                </Dropdown>
            </ButtonGroup>
            <CreateTemplateModal isOpen={isModalOpen} onOpenChange={setIsModalOpen} />
        </div>
    )
}

export default ControlBar