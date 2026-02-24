"use client"

import { ArrowRight } from 'lucide-react'
import { DatePicker } from '@heroui/react'
import { Controller, type Control } from 'react-hook-form'
import { getLocalTimeZone, now } from '@internationalized/date'
import type { CampaignFormValues } from './types'

type ScheduleStepProps = {
    control: Control<CampaignFormValues>
}

const ScheduleStep = ({ control }: ScheduleStepProps) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
        <Controller
            name="scheduleDate"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
                <div className="space-y-4">
                    <DatePicker
                        {...field}
                        label="Schedule Date & Time"
                        variant="bordered"
                        labelPlacement="outside"
                        granularity="minute"
                        hideTimeZone
                        value={field.value}
                        onChange={field.onChange}
                        defaultValue={now(getLocalTimeZone())}
                        color="secondary"
                        hourCycle={24}
                    />

                    {field.value && (
                        <div className="mt-4 px-1 animate-in fade-in slide-in-from-top-1">
                            <div className="flex items-center gap-2 text-small">
                                <span className="text-default-400 font-medium">Execution:</span>

                                <div className="flex items-center gap-1.5 font-bold">
                                    <span className="text-default-400 font-medium">
                                        {field.value.toDate(getLocalTimeZone()).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                    </span>

                                    <span className="text-secondary">
                                        {field.value.toDate(getLocalTimeZone()).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                    </span>

                                    <ArrowRight size={12} className="text-default-300 mx-0.5" />

                                    <span className="text-secondary">
                                        {field.value.add({ minutes: 1 }).toDate(getLocalTimeZone()).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </div>
                            </div>

                            {/* The Note: Permanent and minimalist */}
                            <p className="mt-1 text-[10px] text-default-400 leading-tight">
                                Batch processing starts at the top of the minute. Expect a small delay based on list size.
                            </p>
                        </div>
                    )}
                </div>
            )}
        />
    </div>
)

export default ScheduleStep
