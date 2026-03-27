import { Client } from "@upstash/qstash"
import type { CampaignWorkerJobPayload } from "@/lib/external-job-queue"

const getClient = () => new Client({ token: process.env.QSTASH_TOKEN! })

const CAMPAIGN_JOB_PATH = "/api/jobs/campaign"

export const publishCampaignChunk = async (
    origin: string,
    payload: CampaignWorkerJobPayload,
    options: { deduplicationId?: string } = {},
) => {
    const targetUrl = new URL(CAMPAIGN_JOB_PATH, origin).toString()
    const headers: Record<string, string> = {}
    const secret = process.env.CAMPAIGN_JOB_SECRET?.trim()
    if (secret) headers["x-campaign-job-secret"] = secret

    const result = await getClient().publishJSON({
        url: targetUrl,
        body: payload,
        headers,
        retries: 0,
        ...(options.deduplicationId ? { deduplicationId: options.deduplicationId } : {}),
    })

    return { messageId: result.messageId, targetUrl }
}
