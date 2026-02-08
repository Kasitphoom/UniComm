"use client"

import { Button } from '@heroui/react'
import { PlusIcon } from 'lucide-react'
import React from 'react'

const NewCampaignButton = () => {
    return (
        <>
            <Button color='secondary' startContent={<PlusIcon size={16} />}>Create Campaign</Button>
        </>
    )
}

export default NewCampaignButton