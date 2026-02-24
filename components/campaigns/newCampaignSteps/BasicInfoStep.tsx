"use client"

import { Input } from '@heroui/react'
import { Controller, type Control } from 'react-hook-form'
import type { CampaignFormValues } from './types'

type BasicInfoStepProps = {
    control: Control<CampaignFormValues>
}

const BasicInfoStep = ({ control }: BasicInfoStepProps) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
        <Controller
            name="campaignName"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
                <Input
                    {...field}
                    label="Campaign Name"
                    placeholder="Monthly Statements - Feb 2026"
                    variant="bordered"
                    labelPlacement="outside"
                    value={field.value}
                    onValueChange={field.onChange}
                />
            )}
        />
    </div>
)

export default BasicInfoStep
