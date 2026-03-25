import { NextResponse } from "next/server"
import { runCampaignJob } from "@/utils/campaign"
import { deleteCampaignFileJob } from "@/utils/files"
import { enqueueCampaignWorkerJob, type CampaignWorkerJobPayload } from "@/lib/external-job-queue"
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"
import { getBusinessPrisma } from "@/lib/prisma-business"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const isRunCampaignJobPayload = (
    payload: CampaignWorkerJobPayload,
): payload is Extract<CampaignWorkerJobPayload, { jobType: "RUN_CAMPAIGNS" }> => {
    return payload.jobType === "RUN_CAMPAIGNS"
}

const DEFAULT_CHUNK_SIZE = 100

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

    const queued = await Promise.all(
        Array.from({ length: chunkCount }, (_, chunkIndex) => {
            const chunkOffset = chunkIndex * chunkSize
            const isFinalChunk = chunkOffset + chunkSize >= customerCount

            return enqueueCampaignWorkerJob(
                origin,
                {
                    ...payload,
                    chunked: true,
                    chunkOffset,
                    chunkLimit: chunkSize,
                    isFinalChunk,
                },
                {
                    deduplicationId: `chunk-run-${businessId}-${campaignId}-${chunkOffset}-${chunkSize}-${nowBucket}`,
                },
            )
        }),
    )

    return {
        orchestrated: true,
        campaignId,
        businessId,
        customerCount,
        chunkSize,
        chunkCount,
        messageIds: queued.map((job) => job.messageId).filter(Boolean),
    }
}

async function handler(request: Request) {
    try {
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

            const results = await runCampaignJob({
                campaignId: payload.campaignId,
                businessIds: payload.businessIds,
                maxParallel: payload.maxParallel,
                triggerSource: payload.triggerSource,
                chunk:
                    payload.chunkOffset !== undefined && payload.chunkLimit !== undefined
                        ? {
                              offset: payload.chunkOffset,
                              limit: payload.chunkLimit,
                              isFinalChunk: Boolean(payload.isFinalChunk),
                          }
                        : undefined,
            })

            return NextResponse.json({
                ok: true,
                jobType: payload.jobType,
                mode: payload.chunked ? "CHUNK_EXECUTION" : "DEFAULT_EXECUTION",
                processedBusinesses: results.length,
            })
        }

        if (payload.jobType === "DELETE_EXPIRED_FILES") {
            await deleteCampaignFileJob()
            return NextResponse.json({ ok: true, jobType: payload.jobType })
        }

        return NextResponse.json({ error: "Unsupported job type" }, { status: 400 })
    } catch (error) {
        console.error("Campaign worker execution failed:", error)
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown worker error",
            },
            { status: 500 },
        )
    }
}

export const POST = verifySignatureAppRouter(handler)
