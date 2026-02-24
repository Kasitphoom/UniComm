import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { runCampaignJob } from "@/utils/campaign"
import { userHasPermissionAPI } from "@/utils/permissions"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { Prisma, UserRole } from "@/app/generated/business/prisma"

const campaignInclude = {
    templates: {
        include: {
            template: true,
        },
        orderBy: { createdAt: "asc" },
    },
    logs: {
        orderBy: { createdAt: "desc" },
        take: 5,
    },
    files: {
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
    },
} satisfies Prisma.CampaignInclude

type RouteParams = {
    params: Promise<{ id: string }>
}

export const POST = async (req: NextRequest, { params }: RouteParams) => {
    try {
        const auth = await requireAuth(req)
        if (!auth.ok) return auth.response

        const businessId = auth.businessId
        if (!businessId) {
            return NextResponse.json(
                { error: "No active business selected" },
                { status: 400 },
            )
        }

        const hasPermission = await userHasPermissionAPI(req, [
            UserRole.OWNER,
            UserRole.ADMIN,
            UserRole.MEMBER,
        ])

        if (!hasPermission) {
            return NextResponse.json(
                { error: "Insufficient permissions" },
                { status: 403 },
            )
        }

        const { id: campaignId } = await params
        if (!campaignId) {
            return NextResponse.json(
                { error: "Campaign ID is required" },
                { status: 400 },
            )
        }

        const prisma = await getBusinessPrisma(businessId)

        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: campaignInclude,
        })

        if (!campaign) {
            return NextResponse.json(
                { error: "Campaign not found" },
                { status: 404 },
            )
        }

        const jobResults = await runCampaignJob({
            campaignId,
            businessIds: [businessId],
            triggerSource: "MANUAL",
        })
        const jobResult = jobResults.find((result) => result.businessId === businessId)
        const campaignResult = jobResult?.campaigns.find((result) => result.campaignId === campaignId)

        if (!jobResult || !campaignResult) {
            return NextResponse.json(
                { error: "Campaign job did not return a result", result: jobResult ?? null },
                { status: 500 },
            )
        }

        const updatedCampaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: campaignInclude,
        })

        if (!updatedCampaign) {
            return NextResponse.json(
                { error: "Campaign not found after run", result: campaignResult },
                { status: 404 },
            )
        }

        if (!campaignResult.success) {
            return NextResponse.json(
                {
                    error: campaignResult.error ?? "Failed to execute campaign",
                    result: campaignResult,
                    jobResult,
                    campaign: updatedCampaign,
                },
                { status: 500 },
            )
        }

        return NextResponse.json({ result: campaignResult, jobResult, campaign: updatedCampaign })
    } catch (error) {
        console.error("Error running campaign:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 },
        )
    }
}