import { requireCronAuth } from "@/lib/api-auth";
import { runCampaignJob } from "@/utils/campaign";
import { deleteCampaignFileJob } from "@/utils/files";
import { NextRequest, NextResponse } from "next/server";

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

        const results = await runCampaignJob({ triggerSource: "CRON" });
        await deleteCampaignFileJob();

        return NextResponse.json(
            { message: "Cron job executed", processedBusinesses: results.length },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error executing cron job for campaigns:", error);
        return new Response("Error executing cron job", { status: 500 });
    }
}