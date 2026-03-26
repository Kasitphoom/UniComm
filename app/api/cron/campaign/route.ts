import { requireCronAuth } from "@/lib/api-auth";
import { enqueueCampaignWorkerJob } from "@/lib/external-job-queue";
import { getAllBusinessIds } from "@/utils/business";
import { getBusinessPrisma } from "@/lib/prisma-business";
import { SCHEDULE_STATUS } from "@/app/generated/business/prisma";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const hasRunnableCampaignsNow = async (businessId: string) => {
    const prisma = getBusinessPrisma(businessId);

    const startTime = new Date();
    startTime.setSeconds(0, 0);
    const endTime = new Date(startTime.getTime());
    endTime.setSeconds(endTime.getSeconds() + 59, 999);

    const campaign = await prisma.campaign.findFirst({
        where: {
            scheduleStatus: SCHEDULE_STATUS.PENDING,
            scheduledAt: {
                gte: startTime,
                lte: endTime,
            },
        },
        select: { id: true },
    });

    return Boolean(campaign?.id);
};

const hasExpiredCampaignFiles = async (businessId: string) => {
    const prisma = getBusinessPrisma(businessId);
    const currentTime = new Date();
    currentTime.setSeconds(0, 0);

    const expired = await prisma.campaignFile.findFirst({
        where: {
            isDeleted: false,
            expiresAt: {
                lte: currentTime,
            },
        },
        select: { id: true },
    });

    return Boolean(expired?.id);
};

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
        const auth = await requireCronAuth(request);
        if (!auth.ok) {
            return auth.response;
        }

        const businessIds = await getAllBusinessIds();
        if (!businessIds.length) {
            return NextResponse.json(
                {
                    message: "No businesses available for cron processing",
                    acceptedAt: new Date().toISOString(),
                },
                { status: 200 },
            );
        }

        const checks = await Promise.all(
            businessIds.map(async (businessId) => {
                const [hasCampaigns, hasExpiredFiles] = await Promise.all([
                    hasRunnableCampaignsNow(businessId),
                    hasExpiredCampaignFiles(businessId),
                ]);

                return { hasCampaigns, hasExpiredFiles };
            }),
        );

        const shouldEnqueueCampaignRuns = checks.some((result) => result.hasCampaigns);
        const shouldEnqueueCleanup = checks.some((result) => result.hasExpiredFiles);

        const minuteBucket = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")
        const triggerTasks: Promise<{ messageId?: string }>[] = [];

        if (shouldEnqueueCampaignRuns) {
            triggerTasks.push(
                enqueueCampaignWorkerJob(
                    request.nextUrl.origin,
                    {
                        jobType: "RUN_CAMPAIGNS",
                        triggerSource: "CRON",
                    },
                    {
                        deduplicationId: `cron-run-campaigns-${minuteBucket}`,
                        waitForResponse: true,
                    },
                ),
            );
        }

        if (shouldEnqueueCleanup) {
            triggerTasks.push(
                enqueueCampaignWorkerJob(
                    request.nextUrl.origin,
                    {
                        jobType: "DELETE_EXPIRED_FILES",
                    },
                    {
                        deduplicationId: `cron-delete-expired-files-${minuteBucket}`,
                        waitForResponse: true,
                    },
                ),
            );
        }

        const triggeredJobs = await Promise.all(triggerTasks);
        const runCampaignsQueueJob = shouldEnqueueCampaignRuns ? triggeredJobs.shift() : undefined;
        const cleanupFilesQueueJob = shouldEnqueueCleanup ? triggeredJobs.shift() : undefined;

        return NextResponse.json(
            {
                message:
                    shouldEnqueueCampaignRuns || shouldEnqueueCleanup
                        ? "Cron jobs triggered"
                        : "No campaign or cleanup jobs to trigger",
                acceptedAt: new Date().toISOString(),
                jobs: {
                    runCampaignsEnqueued: shouldEnqueueCampaignRuns,
                    cleanupEnqueued: shouldEnqueueCleanup,
                    runCampaignsMessageId: runCampaignsQueueJob?.messageId,
                    cleanupFilesMessageId: cleanupFilesQueueJob?.messageId,
                },
            },
            { status: 200 },
        );
    } catch (error) {
        return new Response("Error executing cron job", { status: 500 });
    }
}