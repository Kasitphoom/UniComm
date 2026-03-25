"use client"

import React, { useCallback } from 'react'
import { Button, useDisclosure, Tooltip } from '@heroui/react'
import { PlusIcon } from 'lucide-react'
import { getLocalTimeZone } from '@internationalized/date'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { createCampaign } from '@/features/campaigns/campaignsSlice'
import CampaignWizardModal from './CampaignWizardModal'
import type { CampaignFormValues } from './newCampaignSteps/types'
import { useUserHasPermissionClient } from '@/utils/permissions'
import { UserRole } from '@/app/generated/business/prisma'

const NewCampaignButton = () => {
    const dispatch = useAppDispatch()
    const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure()
    const createStatus = useAppSelector((state) => state.campaigns.create.status)
    const canManageCampaigns = useUserHasPermissionClient([
        UserRole.OWNER,
        UserRole.ADMIN,
        UserRole.MEMBER,
    ])

    const handleCreateCampaign = useCallback(async (values: CampaignFormValues) => {
        if (!canManageCampaigns) return
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
    }, [dispatch, canManageCampaigns])

    const handleOpenWizard = useCallback(() => {
        if (!canManageCampaigns) return
        onOpen()
    }, [canManageCampaigns, onOpen])

    return (
        <>
            <Button
                color='secondary'
                onPress={handleOpenWizard}
                startContent={<PlusIcon size={16} />}
                isDisabled={!canManageCampaigns}
            >
                Create Campaign
            </Button>

            <CampaignWizardModal
                isOpen={isOpen && canManageCampaigns}
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