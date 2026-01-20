'use client'
import React, { useState } from 'react'
import { Button } from '@heroui/react'
import { ChevronsUpDown } from 'lucide-react'
import SelectBusinessModal from '../login/SelectBusinessModal'

interface BusinessSelectorProps {
    businessName: string
}

const BusinessSelector = ({ businessName }: BusinessSelectorProps) => {
    const [isModalOpen, setIsModalOpen] = useState(false)

    return (
        <>
            <Button
                variant="light"
                color="default"
                endContent={<ChevronsUpDown size={16} />}
                onPress={() => setIsModalOpen(true)}
                className="max-w-50 sm:max-w-md"
            >
                <span className="truncate">{businessName}</span>
            </Button>
            <SelectBusinessModal isOpen={isModalOpen} onOpenChange={setIsModalOpen} />
        </>
    )
}

export default BusinessSelector
