"use client"

import React, { useCallback } from 'react'
import { Button, useDisclosure } from '@heroui/react'
import { PlusIcon } from 'lucide-react'
import { getLocalTimeZone } from '@internationalized/date'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { createCampaign } from '@/features/campaigns/campaignsSlice'
import CampaignWizardModal from './CampaignWizardModal'
import type { CampaignFormValues } from './newCampaignSteps/types'

const NewCampaignButton = () => {
    const dispatch = useAppDispatch()
    const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure()
    const createStatus = useAppSelector((state) => state.campaigns.create.status)

    const handleCreateCampaign = useCallback(async (values: CampaignFormValues) => {
        if (!values.templateId || !values.customerListId || !values.scheduleDate) {
            return
        }

        const scheduledDate = values.scheduleDate.toDate(getLocalTimeZone())
        if (!scheduledDate) return

        await dispatch(createCampaign({
            name: values.campaignName.trim(),
            scheduledAt: scheduledDate.toISOString(),
            templateId: values.templateId,
            customerListId: values.customerListId,
        })).unwrap()
    }, [dispatch])

    return (
        <>
            <Button
                color='secondary'
                onPress={onOpen}
                startContent={<PlusIcon size={16} />}
            >
                Create Campaign
            </Button>

            <CampaignWizardModal
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                onClose={onClose}
                onSubmit={handleCreateCampaign}
                mode="create"
                isSubmitting={createStatus === 'loading'}
            />
        </>
    )
}

export default NewCampaignButton