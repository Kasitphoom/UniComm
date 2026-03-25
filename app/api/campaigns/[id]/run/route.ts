import { after, NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { runCampaignJob } from "@/utils/campaign"
import { userHasPermissionAPI } from "@/utils/permissions"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { FILE_STATUS, Prisma, SCHEDULE_STATUS, UserRole } from "@/app/generated/business/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

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

/**
 * @swagger
 * /api/campaigns/{id}/run:
 *   post:
 *     summary: Manually run a campaign job
 *     tags:
 *       - Campaigns
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign job executed successfully
 *       400:
 *         description: Missing campaign ID or no active business selected
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Campaign not found
 *       500:
 *         description: Campaign execution failed
 */
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

        await prisma.campaign.update({
            where: { id: campaignId },
            data: {
                scheduleStatus: SCHEDULE_STATUS.PENDING,
                fileStatus: FILE_STATUS.PENDING,
                logs: {
                    create: {
                        message: "[MANUAL] Campaign run queued",
                        status: SCHEDULE_STATUS.PENDING,
                    },
                },
            },
        })

        after(async () => {
            try {
                await runCampaignJob({
                    campaignId,
                    businessIds: [businessId],
                    triggerSource: "MANUAL",
                })
            } catch (error) {
                console.error("Error running campaign in background:", error)
            }
        })

        return NextResponse.json({
            accepted: true,
            campaignId,
            status: "RUNNING",
            message: "Campaign run accepted",
        })
    } catch (error) {
        console.error("Error running campaign:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 },
        )
    }
}

export const GET = async (req: NextRequest, { params }: RouteParams) => {
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

        const latestLogMessage = campaign.logs?.[0]?.message ?? ""
        const isQueuedLog = latestLogMessage.includes("[MANUAL] Campaign run queued")
        const isRunning = campaign.scheduleStatus === SCHEDULE_STATUS.PENDING && isQueuedLog

        return NextResponse.json({
            campaign,
            isRunning,
            status: isRunning ? "RUNNING" : campaign.scheduleStatus,
        })
    } catch (error) {
        console.error("Error fetching campaign run status:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 },
        )
    }
}