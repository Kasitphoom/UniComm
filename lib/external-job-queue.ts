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
    endpointPath?: string
    traceId?: string
    parentHop?: number
    sourceRoute?: string
}

const HEADER_TRIGGER_ID = "x-campaign-job-trigger-id"
const HEADER_TRACE_ID = "x-campaign-job-trace-id"
const HEADER_HOP = "x-campaign-job-hop"
const HEADER_SOURCE_ROUTE = "x-campaign-job-source-route"

const summarizePayload = (payload: CampaignWorkerJobPayload) => {
    if (payload.jobType === "RUN_CAMPAIGNS") {
        return {
            jobType: payload.jobType,
            triggerSource: payload.triggerSource,
            campaignId: payload.campaignId,
            businessIdsCount: payload.businessIds?.length ?? 0,
            chunked: Boolean(payload.chunked),
            chunkOrder: payload.chunkOrder,
            totalChunks: payload.totalChunks,
            chunkOffset: payload.chunkOffset,
            chunkLimit: payload.chunkLimit,
            isFinalChunk: Boolean(payload.isFinalChunk),
            jobId: payload.jobId,
        }
    }

    return {
        jobType: payload.jobType,
    }
}

const getErrorDetails = (error: unknown) => {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            causeCode: (error as { cause?: { code?: string } }).cause?.code,
        }
    }

    return {
        message: String(error),
    }
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
    const endpointPath = options.endpointPath || "/api/jobs/campaign"
    const targetUrl = new URL(endpointPath, workerBaseUrl).toString()
    const triggerId = options.deduplicationId || randomUUID()
    const traceId = options.traceId || triggerId
    const hop = Math.max(1, Math.floor((options.parentHop ?? 0) + 1))
    const sourceRoute = options.sourceRoute || "unknown"

    const headers: HeadersInit = {
        "content-type": "application/json",
        [HEADER_TRIGGER_ID]: triggerId,
        [HEADER_TRACE_ID]: traceId,
        [HEADER_HOP]: String(hop),
        [HEADER_SOURCE_ROUTE]: sourceRoute,
    }

    const internalJobSecret = getOptionalInternalJobSecret()
    if (internalJobSecret) {
        headers["x-campaign-job-secret"] = internalJobSecret
    }

    console.log(
        "[CampaignQueue] enqueue:start",
        JSON.stringify({
            sourceRoute,
            targetUrl,
            workerBaseUrl,
            triggerId,
            traceId,
            hop,
            waitForResponse: Boolean(options.waitForResponse),
            payload: summarizePayload(payload),
        }),
    )

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
                console.error(
                    "[CampaignQueue] enqueue:network-error",
                    JSON.stringify({
                        sourceRoute,
                        targetUrl,
                        triggerId,
                        traceId,
                        hop,
                        payload: summarizePayload(payload),
                        error: getErrorDetails(error),
                    }),
                )
                throw error
            }

            console.warn(
                "[CampaignQueue] enqueue:http-fallback",
                JSON.stringify({
                    sourceRoute,
                    targetUrl,
                    fallbackUrl: asHttpUrl(targetUrl),
                    triggerId,
                    traceId,
                    hop,
                }),
            )

            response = await fetch(asHttpUrl(targetUrl), {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
                cache: "no-store",
            })
        }

        console.log(
            "[CampaignQueue] enqueue:response",
            JSON.stringify({
                sourceRoute,
                targetUrl,
                triggerId,
                traceId,
                hop,
                status: response.status,
                ok: response.ok,
            }),
        )

        if (!response.ok) {
            const responseBody = await response.text().catch(() => "")
            console.error(
                "[CampaignQueue] enqueue:non-ok",
                JSON.stringify({
                    sourceRoute,
                    targetUrl,
                    triggerId,
                    traceId,
                    hop,
                    status: response.status,
                    statusText: response.statusText,
                    responseBody: responseBody.slice(0, 1000),
                }),
            )
            throw new Error(
                `Failed to trigger campaign worker API (${response.status}): ${responseBody || response.statusText}`,
            )
        }
    } else {
        void triggerRequest.catch((error) => {
            if (!shouldRetryWithHttp(targetUrl, error)) {
                console.error(
                    "[CampaignQueue] enqueue:async-network-error",
                    JSON.stringify({
                        sourceRoute,
                        targetUrl,
                        triggerId,
                        traceId,
                        hop,
                        payload: summarizePayload(payload),
                        error: getErrorDetails(error),
                    }),
                )
                return
            }

            console.warn(
                "[CampaignQueue] enqueue:async-http-fallback",
                JSON.stringify({
                    sourceRoute,
                    targetUrl,
                    fallbackUrl: asHttpUrl(targetUrl),
                    triggerId,
                    traceId,
                    hop,
                }),
            )

            void fetch(asHttpUrl(targetUrl), {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
                cache: "no-store",
            }).catch((retryError) => {
                console.error(
                    "[CampaignQueue] enqueue:async-http-fallback-error",
                    JSON.stringify({
                        sourceRoute,
                        targetUrl,
                        fallbackUrl: asHttpUrl(targetUrl),
                        triggerId,
                        traceId,
                        hop,
                        error: getErrorDetails(retryError),
                    }),
                )
            })
        })
    }

    console.log(
        "[CampaignQueue] enqueue:accepted",
        JSON.stringify({
            sourceRoute,
            targetUrl,
            triggerId,
            traceId,
            hop,
        }),
    )

    return {
        targetUrl,
        messageId: triggerId,
    }
}
