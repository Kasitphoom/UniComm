import { after, NextResponse } from "next/server"
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
            waitForResponse: true,
            endpointPath: "/api/jobs/campaign/forward",
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
    try {
        const expectedSecret = process.env.CAMPAIGN_JOB_SECRET?.trim()
        if (expectedSecret) {
            const incomingSecret = request.headers.get("x-campaign-job-secret")?.trim()
            if (!incomingSecret || incomingSecret !== expectedSecret) {
                return NextResponse.json({ error: "Unauthorized job trigger" }, { status: 401 })
            }
        }

        const payload = (await request.json()) as CampaignWorkerJobPayload
        if (!payload || typeof payload !== "object" || !("jobType" in payload)) {
            return NextResponse.json({ error: "Invalid job payload" }, { status: 400 })
        }

        if (isRunCampaignJobPayload(payload)) {
            const canOrchestrateChunks =
                !payload.chunked &&
                payload.triggerSource === "MANUAL" &&
                payload.campaignId &&
                (payload.businessIds?.length ?? 0) === 1

            if (canOrchestrateChunks) {
                const chunkedResult = await enqueueChunkedCampaignJobs(request, payload)
                if (chunkedResult.orchestrated) {
                    return NextResponse.json({
                        ok: true,
                        jobType: payload.jobType,
                        mode: "CHUNK_ORCHESTRATED",
                        ...chunkedResult,
                    })
                }
            }

            const chunkMeta =
                payload.chunkOffset !== undefined && payload.chunkLimit !== undefined
                    ? {
                          jobId: payload.jobId,
                          chunkOrder: payload.chunkOrder,
                          totalChunks: payload.totalChunks,
                          offset: payload.chunkOffset,
                          limit: payload.chunkLimit,
                          isFinalChunk: Boolean(payload.isFinalChunk),
                      }
                    : undefined

            const isChunkedExecution = Boolean(payload.chunked)

            if (isChunkedExecution) {
                const origin = new URL(request.url).origin
                after(async () => {
                    const results = await runCampaignJob({
                        campaignId: payload.campaignId,
                        businessIds: payload.businessIds,
                        maxParallel: payload.maxParallel,
                        triggerSource: payload.triggerSource,
                        chunk: chunkMeta,
                    })

                    const hasNextChunk =
                        typeof payload.chunkOrder === "number" &&
                        typeof payload.totalChunks === "number" &&
                        typeof payload.chunkLimit === "number" &&
                        payload.chunkOrder + 1 < payload.totalChunks
                    const allSucceeded = results.every((result) => result.success)

                    if (hasNextChunk && allSucceeded) {
                        const businessId = payload.businessIds?.[0]
                        const campaignId = payload.campaignId

                        if (businessId && campaignId) {
                            const nextChunkOrder = (payload.chunkOrder as number) + 1
                            const nextChunkOffset = nextChunkOrder * (payload.chunkLimit as number)
                            const nextIsFinalChunk = nextChunkOrder + 1 >= (payload.totalChunks as number)
                            const nowBucket = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")

                            await enqueueCampaignWorkerJob(
                                origin,
                                {
                                    ...payload,
                                    chunkOrder: nextChunkOrder,
                                    chunkOffset: nextChunkOffset,
                                    isFinalChunk: nextIsFinalChunk,
                                },
                                {
                                    deduplicationId: `chunk-run-${businessId}-${campaignId}-${payload.jobId}-${nextChunkOffset}-${payload.chunkLimit}-${nowBucket}`,
                                    waitForResponse: true,
                                    endpointPath: "/api/jobs/campaign/forward",
                                },
                            )
                        }
                    }
                })

                return NextResponse.json({
                    ok: true,
                    jobType: payload.jobType,
                    mode: "CHUNK_EXECUTION_ASYNC",
                })
            }

            const results = await runCampaignJob({
                campaignId: payload.campaignId,
                businessIds: payload.businessIds,
                maxParallel: payload.maxParallel,
                triggerSource: payload.triggerSource,
                chunk: chunkMeta,
            })

            return NextResponse.json({
                ok: true,
                jobType: payload.jobType,
                mode: "DEFAULT_EXECUTION",
                processedBusinesses: results.length,
            })
        }

        if (payload.jobType === "DELETE_EXPIRED_FILES") {
            await deleteCampaignFileJob()
            return NextResponse.json({ ok: true, jobType: payload.jobType })
        }

        return NextResponse.json({ error: "Unsupported job type" }, { status: 400 })
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown worker error",
            },
            { status: 500 },
        )
    }
}

export const POST = handler
