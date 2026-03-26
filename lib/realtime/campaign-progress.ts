export type CampaignProgressEventType =
    | "run-started"
    | "batch-progress"
    | "run-completed"
    | "run-failed"

export type CampaignProgressEvent = {
    type: CampaignProgressEventType
    campaignId: string
    businessId: string
    timestamp: string
    generated?: number
    total?: number
    progress?: number
    message?: string
}

export const getCampaignProgressChannel = (campaignId: string) =>
    `campaign-progress:${campaignId}`
