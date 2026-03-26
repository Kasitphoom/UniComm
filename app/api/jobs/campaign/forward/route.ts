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
    const startedAt = new Date().toISOString()
    const traceId = request.headers.get("x-campaign-job-trace-id")?.trim() || `forward-${startedAt.slice(0, 19).replace(/[:T]/g, "-")}`
    const parentHop = Number(request.headers.get("x-campaign-job-hop") || "0") || 0
    const sourceRoute = request.headers.get("x-campaign-job-source-route")?.trim() || "unknown"
    const incomingTriggerId = request.headers.get("x-campaign-job-trigger-id")?.trim()

    try {
        console.log(
            "[CampaignForwarder] request:start",
            JSON.stringify({
                traceId,
                parentHop,
                sourceRoute,
                incomingTriggerId,
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
                    "[CampaignForwarder] request:unauthorized",
                    JSON.stringify({ traceId, parentHop, sourceRoute, incomingTriggerId }),
                )
                return NextResponse.json({ error: "Unauthorized job trigger" }, { status: 401 })
            }
        }

        const payload = (await request.json()) as unknown
        if (!isValidPayload(payload)) {
            console.warn(
                "[CampaignForwarder] request:invalid-payload",
                JSON.stringify({ traceId, parentHop, sourceRoute, incomingTriggerId }),
            )
            return NextResponse.json({ error: "Invalid job payload" }, { status: 400 })
        }

        console.log(
            "[CampaignForwarder] request:payload",
            JSON.stringify({ traceId, parentHop, sourceRoute, incomingTriggerId, payload }),
        )

        const origin = new URL(request.url).origin
        const deduplicationId =
            incomingTriggerId || `forward-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`

        after(async () => {
            try {
                console.log(
                    "[CampaignForwarder] relay:enqueue-start",
                    JSON.stringify({
                        traceId,
                        parentHop,
                        sourceRoute,
                        incomingTriggerId,
                        deduplicationId,
                    }),
                )

                await enqueueCampaignWorkerJob(origin, payload, {
                    deduplicationId,
                    waitForResponse: true,
                    traceId,
                    parentHop,
                    sourceRoute: "/api/jobs/campaign/forward",
                })

                console.log(
                    "[CampaignForwarder] relay:enqueue-complete",
                    JSON.stringify({
                        traceId,
                        parentHop,
                        sourceRoute,
                        incomingTriggerId,
                        deduplicationId,
                    }),
                )
            } catch (error) {
                console.error(
                    "[CampaignForwarder] relay:enqueue-error",
                    JSON.stringify({
                        traceId,
                        parentHop,
                        sourceRoute,
                        incomingTriggerId,
                        deduplicationId,
                        message: error instanceof Error ? error.message : "Unknown forwarding error",
                        stack: error instanceof Error ? error.stack : undefined,
                    }),
                )
            }
        })

        console.log(
            "[CampaignForwarder] request:accepted",
            JSON.stringify({
                traceId,
                parentHop,
                sourceRoute,
                incomingTriggerId,
                deduplicationId,
            }),
        )

        return NextResponse.json({
            ok: true,
            forwarded: true,
            triggerId: deduplicationId,
        })
    } catch (error) {
        console.error(
            "[CampaignForwarder] request:error",
            JSON.stringify({
                traceId,
                parentHop,
                sourceRoute,
                incomingTriggerId,
                message: error instanceof Error ? error.message : "Unknown forwarder error",
                stack: error instanceof Error ? error.stack : undefined,
            }),
        )
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown forwarder error",
            },
            { status: 500 },
        )
    }
}
