'use client'
import React from 'react'
import ViewMode from '../ViewMode'
import SearchBar from '../SearchBar'
import { Button } from '@heroui/react'
import { FilePlusCorner } from 'lucide-react'

const ControlBar = () => {
    return (
        <div className='flex gap-4 justify-end'>
            <ViewMode />
            <SearchBar />
            <Button color='secondary' startContent={<FilePlusCorner size={16} />}>New Template</Button>
        </div>
    )
}

export default ControlBar