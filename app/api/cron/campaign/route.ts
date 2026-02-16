import { requireCronAuth } from "@/lib/api-auth";
import { runCampaignJob } from "@/utils/campaign";
import { deleteCampaignFileJob } from "@/utils/files";
import { NextRequest, NextResponse } from "next/server";

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