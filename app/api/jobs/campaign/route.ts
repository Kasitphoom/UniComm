import { NextResponse } from "next/server"
import { runCampaignJob } from "@/utils/campaign"
import { deleteCampaignFileJob } from "@/utils/files"
import { enqueueCampaignWorkerJob, type CampaignWorkerJobPayload } from "@/lib/external-job-queue"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { FILE_STATUS, SCHEDULE_STATUS } from "@/app/generated/business/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const isRunCampaignJobPayload = (
    payload: CampaignWorkerJobPayload,
): payload is Extract<CampaignWorkerJobPayload, { jobType: "RUN_CAMPAIGNS" }> => {
    return payload.jobType === "RUN_CAMPAIGNS"
}
const DEFAULT_CHUNK_SIZE = 250

const getChunkSize = () => {
    const rawChunkSize = Number(process.env.CAMPAIGN_JOB_CHUNK_SIZE ?? DEFAULT_CHUNK_SIZE)
    if (!Number.isFinite(rawChunkSize)) return DEFAULT_CHUNK_SIZE
    return Math.max(1, Math.floor(rawChunkSize))
}

const enqueueChunkedCampaignJobs = async (
    request: Request,
    payload: Extract<CampaignWorkerJobPayload, { jobType: "RUN_CAMPAIGNS" }>,
    trace: { traceId: string; parentHop: number },
) => {
    const businessId = payload.businessIds?.[0]
    const campaignId = payload.campaignId

    if (!businessId || !campaignId) {
        return { orchestrated: false }
    }

    const prisma = getBusinessPrisma(businessId)
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
            id: true,
            name: true,
            contactlist: {
                select: {
                    customers: {
                        select: { id: true },
                    },
                },
            },
        },
    })

    const customerCount = campaign?.contactlist?.customers?.length ?? 0
    if (customerCount === 0) {
        return { orchestrated: false }
    }

    const chunkSize = getChunkSize()
    if (customerCount <= chunkSize) {
        return { orchestrated: false }
    }

    const nowBucket = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")
    const chunkCount = Math.ceil(customerCount / chunkSize)
    const origin = new URL(request.url).origin
    const orchestrationStartedAt = new Date()
    const orchestrationRunLog = await (prisma as any).campaignRunLog.create({
        data: {
            campaignId,
            campaignName: campaign?.name ?? "Unknown campaign",
            triggerSource: payload.triggerSource,
            status: SCHEDULE_STATUS.RUNNING,
            success: true,
            fileStatus: FILE_STATUS.PENDING,
            generatedDocuments: 0,
            startedAt: orchestrationStartedAt,
            finishedAt: orchestrationStartedAt,
            durationMs: 0,
        },
    })
    const jobId = orchestrationRunLog.id as string

    const firstChunkOffset = 0
    const firstChunkOrder = 0
    const firstChunkIsFinal = chunkCount === 1
    const queued = await enqueueCampaignWorkerJob(
        origin,
        {
            ...payload,
            chunked: true,
            jobId,
            chunkOrder: firstChunkOrder,
            totalChunks: chunkCount,
            chunkOffset: firstChunkOffset,
            chunkLimit: chunkSize,
            isFinalChunk: firstChunkIsFinal,
        },
        {
            deduplicationId: `chunk-run-${businessId}-${campaignId}-${jobId}-${firstChunkOffset}-${chunkSize}-${nowBucket}`,
            traceId: trace.traceId,
            parentHop: trace.parentHop,
            sourceRoute: "/api/jobs/campaign",
        },
    )

    return {
        orchestrated: true,
        campaignId,
        businessId,
        customerCount,
        chunkSize,
        chunkCount,
        jobId,
        messageIds: [queued.messageId].filter(Boolean),
    }
}

async function handler(request: Request) {
    const startedAt = new Date().toISOString()
    const traceId = request.headers.get("x-campaign-job-trace-id")?.trim() || `job-${startedAt.slice(0, 19).replace(/[:T]/g, "-")}`
    const parentHop = Number(request.headers.get("x-campaign-job-hop") || "0") || 0
    const incomingTriggerId = request.headers.get("x-campaign-job-trigger-id")?.trim()
    const sourceRoute = request.headers.get("x-campaign-job-source-route")?.trim() || "unknown"

    try {
        console.log(
            "[CampaignWorker] request:start",
            JSON.stringify({
                traceId,
                parentHop,
                incomingTriggerId,
                sourceRoute,
                method: request.method,
                url: request.url,
                startedAt,
            }),
        )

        const expectedSecret = process.env.CAMPAIGN_JOB_SECRET?.trim()
        if (expectedSecret) {
            const incomingSecret = request.headers.get("x-campaign-job-secret")?.trim()
            if (!incomingSecret || incomingSecret !== expectedSecret) {
                console.warn(
                    "[CampaignWorker] request:unauthorized",
                    JSON.stringify({ traceId, parentHop, incomingTriggerId, sourceRoute }),
                )
                return NextResponse.json({ error: "Unauthorized job trigger" }, { status: 401 })
            }
        }

        const payload = (await request.json()) as CampaignWorkerJobPayload
        if (!payload || typeof payload !== "object" || !("jobType" in payload)) {
            console.warn(
                "[CampaignWorker] request:invalid-payload",
                JSON.stringify({ traceId, parentHop, incomingTriggerId, sourceRoute }),
            )
            return NextResponse.json({ error: "Invalid job payload" }, { status: 400 })
        }

        console.log(
            "[CampaignWorker] request:payload",
            JSON.stringify({
                traceId,
                parentHop,
                incomingTriggerId,
                sourceRoute,
                payload,
            }),
        )

        if (isRunCampaignJobPayload(payload)) {
            const canOrchestrateChunks =
                !payload.chunked &&
                payload.triggerSource === "MANUAL" &&
                payload.campaignId &&
                (payload.businessIds?.length ?? 0) === 1

            if (canOrchestrateChunks) {
                const chunkedResult = await enqueueChunkedCampaignJobs(request, payload, {
                    traceId,
                    parentHop,
                })
                if (chunkedResult.orchestrated) {
                    console.log(
                        "[CampaignWorker] request:chunk-orchestrated",
                        JSON.stringify({
                            traceId,
                            parentHop,
                            incomingTriggerId,
                            sourceRoute,
                            ...chunkedResult,
                        }),
                    )

                    return NextResponse.json({
                        ok: true,
                        jobType: payload.jobType,
                        mode: "CHUNK_ORCHESTRATED",
                        ...chunkedResult,
                    })
                }
            }

            const results = await runCampaignJob({
                campaignId: payload.campaignId,
                businessIds: payload.businessIds,
                maxParallel: payload.maxParallel,
                triggerSource: payload.triggerSource,
                chunk:
                    payload.chunkOffset !== undefined && payload.chunkLimit !== undefined
                        ? {
                              jobId: payload.jobId,
                              chunkOrder: payload.chunkOrder,
                              totalChunks: payload.totalChunks,
                              offset: payload.chunkOffset,
                              limit: payload.chunkLimit,
                              isFinalChunk: Boolean(payload.isFinalChunk),
                          }
                        : undefined,
            })

            const isChunkedExecution = Boolean(payload.chunked)
            const hasNextChunk =
                isChunkedExecution &&
                typeof payload.chunkOrder === "number" &&
                typeof payload.totalChunks === "number" &&
                typeof payload.chunkLimit === "number" &&
                payload.chunkOrder + 1 < payload.totalChunks
            const allSucceeded = results.every((result) => result.success)

            let nextChunkMessageId: string | undefined
            if (hasNextChunk && allSucceeded) {
                const businessId = payload.businessIds?.[0]
                const campaignId = payload.campaignId

                if (businessId && campaignId) {
                    const nextChunkOrder = (payload.chunkOrder as number) + 1
                    const nextChunkOffset = nextChunkOrder * (payload.chunkLimit as number)
                    const nextIsFinalChunk = nextChunkOrder + 1 >= (payload.totalChunks as number)
                    const origin = new URL(request.url).origin
                    const nowBucket = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")

                    const nextChunkJob = await enqueueCampaignWorkerJob(
                        origin,
                        {
                            ...payload,
                            chunkOrder: nextChunkOrder,
                            chunkOffset: nextChunkOffset,
                            isFinalChunk: nextIsFinalChunk,
                        },
                        {
                            deduplicationId: `chunk-run-${businessId}-${campaignId}-${payload.jobId}-${nextChunkOffset}-${payload.chunkLimit}-${nowBucket}`,
                            waitForResponse: false,
                            endpointPath: "/api/jobs/campaign/forward",
                            traceId,
                            parentHop,
                            sourceRoute: "/api/jobs/campaign",
                        },
                    )

                    console.log(
                        "[CampaignWorker] relay:next-chunk-enqueued",
                        JSON.stringify({
                            traceId,
                            parentHop,
                            incomingTriggerId,
                            sourceRoute,
                            nextChunkOrder,
                            nextChunkOffset,
                            totalChunks: payload.totalChunks,
                            nextChunkMessageId: nextChunkJob.messageId,
                        }),
                    )

                    nextChunkMessageId = nextChunkJob.messageId
                }
            }

            console.log(
                "[CampaignWorker] request:complete",
                JSON.stringify({
                    traceId,
                    parentHop,
                    incomingTriggerId,
                    sourceRoute,
                    jobType: payload.jobType,
                    mode: payload.chunked ? "CHUNK_EXECUTION_SEQUENTIAL" : "DEFAULT_EXECUTION",
                    processedBusinesses: results.length,
                    allSucceeded,
                    nextChunkMessageId,
                }),
            )

            return NextResponse.json({
                ok: true,
                jobType: payload.jobType,
                mode: payload.chunked ? "CHUNK_EXECUTION_SEQUENTIAL" : "DEFAULT_EXECUTION",
                processedBusinesses: results.length,
                nextChunkMessageId,
            })
        }

        if (payload.jobType === "DELETE_EXPIRED_FILES") {
            await deleteCampaignFileJob()
            console.log(
                "[CampaignWorker] request:cleanup-complete",
                JSON.stringify({
                    traceId,
                    parentHop,
                    incomingTriggerId,
                    sourceRoute,
                    jobType: payload.jobType,
                }),
            )
            return NextResponse.json({ ok: true, jobType: payload.jobType })
        }

        console.warn(
            "[CampaignWorker] request:unsupported-job",
            JSON.stringify({
                traceId,
                parentHop,
                incomingTriggerId,
                sourceRoute,
                payload,
            }),
        )

        return NextResponse.json({ error: "Unsupported job type" }, { status: 400 })
    } catch (error) {
        console.error(
            "[CampaignWorker] request:error",
            JSON.stringify({
                traceId,
                parentHop,
                incomingTriggerId,
                sourceRoute,
                message: error instanceof Error ? error.message : "Unknown worker error",
                stack: error instanceof Error ? error.stack : undefined,
            }),
        )
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown worker error",
            },
            { status: 500 },
        )
    }
}

export const POST = handler
