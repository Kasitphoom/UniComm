import { NextResponse } from "next/server"
import { runCampaignJob } from "@/utils/campaign"
import { deleteCampaignFileJob } from "@/utils/files"
import type { CampaignWorkerJobPayload } from "@/lib/external-job-queue"
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const isRunCampaignJobPayload = (
    payload: CampaignWorkerJobPayload,
): payload is Extract<CampaignWorkerJobPayload, { jobType: "RUN_CAMPAIGNS" }> => {
    return payload.jobType === "RUN_CAMPAIGNS"
}

async function handler(request: Request) {
    try {
        const payload = (await request.json()) as CampaignWorkerJobPayload
        if (!payload || typeof payload !== "object" || !("jobType" in payload)) {
            return NextResponse.json({ error: "Invalid job payload" }, { status: 400 })
        }

        if (isRunCampaignJobPayload(payload)) {
            const results = await runCampaignJob({
                campaignId: payload.campaignId,
                businessIds: payload.businessIds,
                maxParallel: payload.maxParallel,
                triggerSource: payload.triggerSource,
            })

            return NextResponse.json({
                ok: true,
                jobType: payload.jobType,
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
