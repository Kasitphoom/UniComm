import { randomUUID } from "crypto"

export type CampaignJobTrigger = "MANUAL" | "CRON" | "SYSTEM"

export type CampaignWorkerJobPayload =
    | {
          jobType: "RUN_CAMPAIGNS"
          triggerSource: CampaignJobTrigger
          campaignId?: string
          businessIds?: string[]
          maxParallel?: number
          jobId?: string
          chunkOrder?: number
          totalChunks?: number
          chunkOffset?: number
          chunkLimit?: number
          isFinalChunk?: boolean
          chunked?: boolean
      }
    | {
          jobType: "DELETE_EXPIRED_FILES"
      }

type EnqueueCampaignWorkerJobOptions = {
    deduplicationId?: string
    retries?: number
    waitForResponse?: boolean
}

const resolveWorkerBaseUrl = (origin: string) => {
    const explicitWorkerUrl = process.env.WORKER_API_URL?.trim()
    if (explicitWorkerUrl) return explicitWorkerUrl

    const appUrl = process.env.APP_URL?.trim()
    if (appUrl) return appUrl

    const vercelUrl = process.env.VERCEL_URL?.trim()
    if (vercelUrl) {
        return /^https?:\/\//i.test(vercelUrl) ? vercelUrl : `https://${vercelUrl}`
    }

    return origin
}

const getOptionalInternalJobSecret = () => process.env.CAMPAIGN_JOB_SECRET?.trim()

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

const shouldRetryWithHttp = (targetUrl: string, error: unknown) => {
    const cause = (error as { cause?: { code?: string } })?.cause
    const code = cause?.code

    if (code !== "ERR_SSL_WRONG_VERSION_NUMBER") {
        return false
    }

    const target = new URL(targetUrl)
    return target.protocol === "https:" && LOOPBACK_HOSTS.has(target.hostname.toLowerCase())
}

const asHttpUrl = (targetUrl: string) => {
    const url = new URL(targetUrl)
    url.protocol = "http:"
    return url.toString()
}

export const enqueueCampaignWorkerJob = async (
    origin: string,
    payload: CampaignWorkerJobPayload,
    options: EnqueueCampaignWorkerJobOptions = {},
) => {
    const workerBaseUrl = resolveWorkerBaseUrl(origin)
    const targetUrl = new URL("/api/jobs/campaign", workerBaseUrl).toString()
    const triggerId = options.deduplicationId || randomUUID()

    const headers: HeadersInit = {
        "content-type": "application/json",
        "x-campaign-job-trigger-id": triggerId,
    }

    const internalJobSecret = getOptionalInternalJobSecret()
    if (internalJobSecret) {
        headers["x-campaign-job-secret"] = internalJobSecret
    }

    const triggerRequest = fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        cache: "no-store",
    })

    if (options.waitForResponse) {
        let response: Response

        try {
            response = await triggerRequest
        } catch (error) {
            if (!shouldRetryWithHttp(targetUrl, error)) {
                throw error
            }

            response = await fetch(asHttpUrl(targetUrl), {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
                cache: "no-store",
            })
        }

        if (!response.ok) {
            const responseBody = await response.text().catch(() => "")
            throw new Error(
                `Failed to trigger campaign worker API (${response.status}): ${responseBody || response.statusText}`,
            )
        }
    } else {
        void triggerRequest.catch((error) => {
            if (!shouldRetryWithHttp(targetUrl, error)) {
                console.error("Failed to trigger campaign worker API:", error)
                return
            }

            void fetch(asHttpUrl(targetUrl), {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
                cache: "no-store",
            }).catch((retryError) => {
                console.error("Failed to trigger campaign worker API after HTTP fallback:", retryError)
            })
        })
    }

    return {
        targetUrl,
        messageId: triggerId,
    }
}
