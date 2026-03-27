import { requireCronAuth } from "@/lib/api-auth";
import { publishCampaignChunk } from "@/lib/qstash";
import { getAllBusinessIds } from "@/utils/business";
import { getBusinessPrisma } from "@/lib/prisma-business";
import { SCHEDULE_STATUS } from "@/app/generated/business/prisma";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const getRunnableCampaignIds = async (businessId: string): Promise<string[]> => {
    const prisma = getBusinessPrisma(businessId);

    const startTime = new Date();
    startTime.setSeconds(0, 0);
    const endTime = new Date(startTime.getTime());
    endTime.setSeconds(endTime.getSeconds() + 59, 999);

    const campaigns = await prisma.campaign.findMany({
        where: {
            scheduleStatus: SCHEDULE_STATUS.PENDING,
            scheduledAt: {
                gte: startTime,
                lte: endTime,
            },
        },
        select: { id: true },
    });

    return campaigns.map((c) => c.id);
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

        const minuteBucket = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
        const origin = request.nextUrl.origin;

        const checks = await Promise.all(
            businessIds.map(async (businessId) => {
                const [campaignIds, hasExpiredFiles] = await Promise.all([
                    getRunnableCampaignIds(businessId),
                    hasExpiredCampaignFiles(businessId),
                ]);
                return { businessId, campaignIds, hasExpiredFiles };
            }),
        );

        const campaignPublishes: Promise<{ messageId: string; targetUrl: string }>[] = [];
        for (const { businessId, campaignIds } of checks) {
            for (const campaignId of campaignIds) {
                campaignPublishes.push(
                    publishCampaignChunk(
                        origin,
                        {
                            jobType: "RUN_CAMPAIGNS",
                            triggerSource: "CRON",
                            campaignId,
                            businessIds: [businessId],
                        },
                        {
                            deduplicationId: `cron-run-${businessId}-${campaignId}-${minuteBucket}`,
                        },
                    ),
                );
            }
        }

        const shouldEnqueueCleanup = checks.some((result) => result.hasExpiredFiles);
        if (shouldEnqueueCleanup) {
            campaignPublishes.push(
                publishCampaignChunk(
                    origin,
                    { jobType: "DELETE_EXPIRED_FILES" },
                    { deduplicationId: `cron-delete-expired-files-${minuteBucket}` },
                ),
            );
        }

        if (campaignPublishes.length === 0) {
            return NextResponse.json(
                {
                    message: "No campaign or cleanup jobs to trigger",
                    acceptedAt: new Date().toISOString(),
                },
                { status: 200 },
            );
        }

        const published = await Promise.all(campaignPublishes);
        const campaignMessageIds = published.slice(0, published.length - (shouldEnqueueCleanup ? 1 : 0)).map((p) => p.messageId);
        const cleanupMessageId = shouldEnqueueCleanup ? published[published.length - 1].messageId : undefined;

        return NextResponse.json(
            {
                message: "Cron jobs triggered",
                acceptedAt: new Date().toISOString(),
                jobs: {
                    campaignsEnqueued: campaignMessageIds.length,
                    campaignMessageIds,
                    cleanupEnqueued: shouldEnqueueCleanup,
                    cleanupMessageId,
                },
            },
            { status: 200 },
        );
    } catch (error) {
        return new Response("Error executing cron job", { status: 500 });
    }
}
