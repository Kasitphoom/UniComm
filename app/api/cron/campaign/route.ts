import { requireCronAuth } from "@/lib/api-auth";
import { enqueueCampaignWorkerJob } from "@/lib/external-job-queue";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * @swagger
 * /api/cron/campaign:
 *   get:
 *     summary: Execute scheduled campaign and cleanup cron jobs
 *     tags:
 *       - Cron
 *     description: Requires cron-level authentication and triggers campaign processing for all businesses.
 *     responses:
 *       200:
 *         description: Cron job executed successfully
 *       401:
 *         description: Unauthorized cron request
 *       500:
 *         description: Error executing cron job
 */
export const GET = async (request: NextRequest) => {
    try {
        console.log("Cron job for campaigns executed at", new Date().toISOString());

        const auth = await requireCronAuth(request);
        if (!auth.ok) {
            return auth.response;
        }

        const minuteBucket = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")

        const [runCampaignsQueueJob, cleanupFilesQueueJob] = await Promise.all([
            enqueueCampaignWorkerJob(
                request.nextUrl.origin,
                {
                    jobType: "RUN_CAMPAIGNS",
                    triggerSource: "CRON",
                },
                {
                    deduplicationId: `cron-run-campaigns-${minuteBucket}`,
                },
            ),
            enqueueCampaignWorkerJob(
                request.nextUrl.origin,
                {
                    jobType: "DELETE_EXPIRED_FILES",
                },
                {
                    deduplicationId: `cron-delete-expired-files-${minuteBucket}`,
                },
            ),
        ])

        console.log(
            "Cron jobs enqueued",
            JSON.stringify({
                runCampaignsMessageId: runCampaignsQueueJob.messageId,
                cleanupFilesMessageId: cleanupFilesQueueJob.messageId,
            }),
        )

        return NextResponse.json(
            {
                message: "Cron jobs enqueued",
                acceptedAt: new Date().toISOString(),
                jobs: {
                    runCampaignsMessageId: runCampaignsQueueJob.messageId,
                    cleanupFilesMessageId: cleanupFilesQueueJob.messageId,
                },
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error executing cron job for campaigns:", error);
        return new Response("Error executing cron job", { status: 500 });
    }
}