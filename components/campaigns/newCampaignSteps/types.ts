import { DateValue } from '@heroui/react'

export type CampaignFormValues = {
    campaignName: string
    templateId: string | null
    customerListId: string | null
    scheduleDate: DateValue | null
}
