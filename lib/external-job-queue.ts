import { Client } from "@upstash/qstash"

export type CampaignJobTrigger = "MANUAL" | "CRON" | "SYSTEM"

export type CampaignWorkerJobPayload =
    | {
          jobType: "RUN_CAMPAIGNS"
          triggerSource: CampaignJobTrigger
          campaignId?: string
          businessIds?: string[]
          maxParallel?: number
      }
    | {
          jobType: "DELETE_EXPIRED_FILES"
      }

type EnqueueCampaignWorkerJobOptions = {
    deduplicationId?: string
    retries?: number
}

const DEFAULT_RETRIES = 5

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

const getQstashToken = () => {
    const token = process.env.QSTASH_TOKEN

    if (!token) {
        throw new Error("QSTASH_TOKEN is not configured")
    }

    return token
}

const qstashClient = new Client({ token: getQstashToken() })

const isLoopbackHost = (hostname: string) => LOOPBACK_HOSTS.has(hostname.toLowerCase())

const resolveWorkerBaseUrl = (origin: string) => {
    const explicitWorkerUrl = process.env.QSTASH_WORKER_URL?.trim()
    if (explicitWorkerUrl) return explicitWorkerUrl

    const appUrl = process.env.APP_URL?.trim()
    if (appUrl) return appUrl

    const vercelUrl = process.env.VERCEL_URL?.trim()
    if (vercelUrl) {
        return /^https?:\/\//i.test(vercelUrl) ? vercelUrl : `https://${vercelUrl}`
    }

    const originUrl = new URL(origin)
    if (isLoopbackHost(originUrl.hostname)) {
        throw new Error(
            "QStash cannot call loopback/local URLs. Set QSTASH_WORKER_URL (recommended) or APP_URL to your public deployment URL.",
        )
    }

    return origin
}

export const enqueueCampaignWorkerJob = async (
    origin: string,
    payload: CampaignWorkerJobPayload,
    options: EnqueueCampaignWorkerJobOptions = {},
) => {
    const workerBaseUrl = resolveWorkerBaseUrl(origin)
    const targetUrl = new URL("/api/jobs/campaign", workerBaseUrl).toString()
    const retries = Math.max(0, options.retries ?? DEFAULT_RETRIES)

    const result = await qstashClient.publishJSON({
        url: targetUrl,
        body: payload,
        retries,
        deduplicationId: options.deduplicationId,
    })

    return {
        targetUrl,
        messageId: result.messageId,
    }
}
