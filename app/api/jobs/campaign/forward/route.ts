import { after, NextResponse } from "next/server"
import {
    enqueueCampaignWorkerJob,
    type CampaignWorkerJobPayload,
} from "@/lib/external-job-queue"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const isValidPayload = (payload: unknown): payload is CampaignWorkerJobPayload =>
    Boolean(payload && typeof payload === "object" && "jobType" in payload)

export const POST = async (request: Request) => {
    try {
        const expectedSecret = process.env.CAMPAIGN_JOB_SECRET?.trim()
        if (expectedSecret) {
            const incomingSecret = request.headers.get("x-campaign-job-secret")?.trim()
            if (!incomingSecret || incomingSecret !== expectedSecret) {
                return NextResponse.json({ error: "Unauthorized job trigger" }, { status: 401 })
            }
        }

        const payload = (await request.json()) as unknown
        if (!isValidPayload(payload)) {
            return NextResponse.json({ error: "Invalid job payload" }, { status: 400 })
        }

        const origin = new URL(request.url).origin
        const incomingTriggerId = request.headers.get("x-campaign-job-trigger-id")?.trim()
        const deduplicationId =
            incomingTriggerId || `forward-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`

        after(async () => {
            try {
                await enqueueCampaignWorkerJob(origin, payload, {
                    deduplicationId,
                    waitForResponse: true,
                })
            } catch (error) {
                console.error("Failed to forward campaign worker job:", error)
            }
        })

        return NextResponse.json({
            ok: true,
            forwarded: true,
            triggerId: deduplicationId,
        })
    } catch (error) {
        console.error("Campaign job forwarder failed:", error)
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown forwarder error",
            },
            { status: 500 },
        )
    }
}
