'use client'
import React from 'react'
import ViewMode from '../ViewMode'
import SearchBar from '../SearchBar'
import { Button, ButtonGroup, Dropdown, DropdownMenu, DropdownTrigger, DropdownItem } from '@heroui/react'
import { ChevronDown, FilePlusCorner } from 'lucide-react'

const ControlBar = () => {
    return (
        <div className='flex gap-4 justify-end'>
            <ViewMode />
            <SearchBar />
            <ButtonGroup className='rounded-xl overflow-hidden'>
                <Button color='secondary' startContent={<FilePlusCorner size={16} />}>New Template</Button>
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
        </div>
    )
}

export default ControlBar