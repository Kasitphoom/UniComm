import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { runCampaignJob } from "@/utils/campaign"
import { userHasPermissionAPI } from "@/utils/permissions"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { FILE_STATUS, Prisma, SCHEDULE_STATUS, UserRole } from "@/app/generated/business/prisma"

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

        const jobResults = await runCampaignJob({ campaignId, businessIds: [businessId] })
        const jobResult = jobResults.find((result) => result.businessId === businessId)

        const runSucceeded = Boolean(jobResult?.success)
        const hasGeneratedFile = Boolean(jobResult?.lastFileId)
        const nextFileStatus = runSucceeded
            ? hasGeneratedFile
                ? FILE_STATUS.AVALIABLE
                : FILE_STATUS.EMPTY
            : FILE_STATUS.FAILED
        const nextScheduleStatus = runSucceeded ? SCHEDULE_STATUS.TRIGGERED : SCHEDULE_STATUS.FAILED

        const updatedCampaign = await prisma.campaign.update({
            where: { id: campaignId },
            data: {
                fileStatus: nextFileStatus,
                scheduleStatus: nextScheduleStatus,
                executedAt: new Date(),
            },
            include: campaignInclude,
        })

        if (!runSucceeded) {
            return NextResponse.json(
                {
                    error: jobResult?.error ?? "Failed to execute campaign",
                    result: jobResult ?? null,
                    campaign: updatedCampaign,
                },
                { status: 500 },
            )
        }

        return NextResponse.json({ result: jobResult ?? null, campaign: updatedCampaign })
    } catch (error) {
        console.error("Error running campaign:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 },
        )
    }
}