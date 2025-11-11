'use client'
import React, { useState } from 'react'
import ViewMode from '../ViewMode'
import SearchBar from '../SearchBar'
import { Button, ButtonGroup, Dropdown, DropdownMenu, DropdownTrigger, DropdownItem } from '@heroui/react'
import { ChevronDown, FilePlusCorner } from 'lucide-react'
import CreateTemplateModal from './CreateTemplateModal'

const ControlBar = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    return (
        <div className='flex gap-4 justify-end'>
            <ViewMode />
            <SearchBar />
            <ButtonGroup className='rounded-xl overflow-hidden'>
                <Button color='secondary' startContent={<FilePlusCorner size={16} />} onPress={() => setIsModalOpen(true)}>New Template</Button>
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