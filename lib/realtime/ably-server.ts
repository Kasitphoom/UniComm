import * as Ably from "ably"
import {
    CampaignProgressEvent,
    CampaignProgressEventType,
    getCampaignProgressChannel,
} from "@/lib/realtime/campaign-progress"

let ablyRestClient: Ably.Rest | null = null
let isPublishingDisabled = false
let lastRateLimitWarningAt = 0

const getAblyRestClient = () => {
    if (ablyRestClient) return ablyRestClient

    const apiKey = process.env.ABLY_PUBLISH_API_KEY?.trim() || process.env.ABLY_API_KEY?.trim()
    if (!apiKey) return null

    ablyRestClient = new Ably.Rest(apiKey)
    return ablyRestClient
}

type PublishCampaignProgressInput = Omit<CampaignProgressEvent, "timestamp"> & {
    timestamp?: string
}

export const publishCampaignProgressEvent = async (
    payload: PublishCampaignProgressInput,
) => {
    if (isPublishingDisabled) return

    const client = getAblyRestClient()
    if (!client) return

    const channel = client.channels.get(getCampaignProgressChannel(payload.campaignId))
    const eventType: CampaignProgressEventType = payload.type
    const data: CampaignProgressEvent = {
        ...payload,
        timestamp: payload.timestamp ?? new Date().toISOString(),
    }

    try {
        await channel.publish(eventType, data)
    } catch (error) {
        const ablyError = error as { code?: number; statusCode?: number; message?: string }
        const isAuthCapabilityError =
            ablyError?.code === 40160 || ablyError?.statusCode === 401
        const isRateLimitError =
            ablyError?.code === 42910 || ablyError?.statusCode === 429

        if (isAuthCapabilityError) {
            isPublishingDisabled = true
            console.error(
                "Ably publishing disabled due to authorization/capability error. Ensure ABLY_PUBLISH_API_KEY (or ABLY_API_KEY) has publish capability on campaign-progress:* channels.",
                error,
            )
            return
        }

        if (isRateLimitError) {
            const now = Date.now()
            if (now - lastRateLimitWarningAt > 10000) {
                lastRateLimitWarningAt = now
                console.warn(
                    "Ably rate limit reached for campaign progress channel; progress updates are being throttled.",
                    ablyError?.message || error,
                )
            }
            return
        }

        console.error("Failed to publish campaign progress event:", error)
    }
}
