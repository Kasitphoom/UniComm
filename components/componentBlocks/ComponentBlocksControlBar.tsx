'use client'
import React, { useState } from 'react'
import ViewMode from '../ViewMode'
import SearchBar from '../SearchBar'
import { Button, ButtonGroup, Dropdown, DropdownMenu, DropdownTrigger, DropdownItem } from '@heroui/react'
import { ChevronDown, Layers } from 'lucide-react'
import CreateComponentBlockModal from './CreateComponentBlockModal'

const ComponentBlocksControlBar = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    return (
        <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-end'>
            <div className='flex items-center gap-2'>
                <ViewMode />
                <SearchBar />
            </div>
            <ButtonGroup className='rounded-xl overflow-hidden'>
                <Button color='secondary' className='w-full' startContent={<Layers size={16} />} onPress={() => setIsModalOpen(true)}>New Component Block</Button>
                <Dropdown placement='bottom-end'>
                    <DropdownTrigger className='min-w-0'>
                        <Button color='secondary'><ChevronDown size={16}/></Button>
                    </DropdownTrigger>
                    <DropdownMenu
                        disallowEmptySelection
                        aria-label="Create component block options"
                        selectionMode="single"
                    >
                        <DropdownItem key="import" description="Import a component block definition">
                            Import Block
                        </DropdownItem>
                    </DropdownMenu>
                </Dropdown>
            </ButtonGroup>
            <CreateComponentBlockModal isOpen={isModalOpen} onOpenChange={setIsModalOpen} />
        </div>
    )
}

export default ComponentBlocksControlBar