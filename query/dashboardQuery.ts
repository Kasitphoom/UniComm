import type { Prisma } from "@/app/generated/business/prisma"
import { getBusinessPrismaByCookie } from "@/lib/prisma-business"

export type PerformanceStats = {
    documentsGenerated: number
    totalCampaigns: number
    failedCampaigns: number
    errorRate: number
    processingSpeed: number
}

type PendingTemplateApproval = {
    templateId: string
    templateTitle: string
}

type UpcomingCampaign = {
    id: string
    name: string
    scheduledAt: Date
}

type ScheduledCampaign = {
    id: string
    name: string
    scheduledAt: Date
    isOverdue: boolean
}

type ErrorCampaign = {
    id: string
    name: string
    scheduledAt: Date
}

type DateWindow = {
    from: Date
    to: Date
}

type StatsQuery = {
    campaignWhere?: Prisma.CampaignWhereInput
    runLogWhere?: any
}

const getProcessingStats = async ({ campaignWhere = {}, runLogWhere = {} }: StatsQuery = {}): Promise<PerformanceStats> => {
    const prismaBusiness = await getBusinessPrismaByCookie()

    const [aggregateResult, runLogStats, failedRuns] = await Promise.all([
        prismaBusiness.campaign.aggregate({
            where: campaignWhere,
            _count: {
                id: true,
            },
        }),
        (prismaBusiness as any).campaignRunLog.aggregate({
            where: runLogWhere,
            _count: {
                id: true,
            },
            _sum: {
                generatedDocuments: true,
                durationMs: true,
            },
        }).catch(() => ({ _count: { id: 0 }, _sum: { generatedDocuments: 0, durationMs: 0 } })),
        (prismaBusiness as any).campaignRunLog.count({
            where: {
                ...runLogWhere,
                success: false,
            },
        }).catch(() => 0),
    ])

    const documentsGenerated = runLogStats?._sum?.generatedDocuments ?? 0

    const totalCampaigns = aggregateResult._count.id ?? 0

    const totalRuns = runLogStats?._count?.id ?? 0
    const failedCampaigns = failedRuns

    const safeTotalRuns = totalRuns === 0 ? 1 : totalRuns
    const errorRate = totalRuns > 0 ? (failedRuns / safeTotalRuns) * 100 : 0

    const totalProcessingSeconds = (runLogStats?._sum?.durationMs ?? 0) / 1000

    const processingSpeed = totalProcessingSeconds > 0 ? documentsGenerated / totalProcessingSeconds : 0

    return {
        documentsGenerated,
        totalCampaigns,
        failedCampaigns,
        errorRate,
        processingSpeed,
    }
}

const getDateWindowWhere = ({ from, to }: DateWindow): Prisma.CampaignWhereInput => {
    return {
        createdAt: {
            gte: from,
            lt: to,
        },
    }
}

const getDateWindowRunLogWhere = ({ from, to }: DateWindow): any => {
    return {
        finishedAt: {
            gte: from,
            lt: to,
        },
    }
}

export const getDashboardPerformanceStats = async (currentUserId?: string) => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(now.getDate() - 30)

    const sixtyDaysAgo = new Date(now)
    sixtyDaysAgo.setDate(now.getDate() - 60)

    const prismaBusiness = await getBusinessPrismaByCookie()

    const [allTime, last30Days, previous30Days, scheduledCampaignRows, errorCampaignRows, pendingTemplateRows] = await Promise.all([
        getProcessingStats(),
        getProcessingStats({
            campaignWhere: getDateWindowWhere({ from: thirtyDaysAgo, to: now }),
            runLogWhere: getDateWindowRunLogWhere({ from: thirtyDaysAgo, to: now }),
        }),
        getProcessingStats({
            campaignWhere: getDateWindowWhere({ from: sixtyDaysAgo, to: thirtyDaysAgo }),
            runLogWhere: getDateWindowRunLogWhere({ from: sixtyDaysAgo, to: thirtyDaysAgo }),
        }),
        prismaBusiness.campaign.findMany({
            where: {
                scheduleStatus: "PENDING",
            },
            orderBy: {
                scheduledAt: "asc",
            },
            select: {
                id: true,
                name: true,
                scheduledAt: true,
            },
            take: 6,
        }),
        prismaBusiness.campaign.findMany({
            where: {
                scheduleStatus: "FAILED",
            },
            orderBy: {
                updatedAt: "desc",
            },
            select: {
                id: true,
                name: true,
                scheduledAt: true,
            },
            take: 6,
        }),
        currentUserId
            ? prismaBusiness.templates.findMany({
                  where: {
                      approvers: {
                          some: {
                              status: "PENDING",
                              userId: currentUserId,
                          },
                      },
                  },
                  orderBy: {
                      createdAt: "asc",
                  },
                  select: {
                      id: true,
                      title: true,
                  },
                  take: 6,
              })
            : Promise.resolve([]),
    ])

    const hasMoreScheduledCampaigns = scheduledCampaignRows.length > 5
    const hasMoreErrorCampaigns = errorCampaignRows.length > 5
    const hasMorePendingTemplateApprovals = pendingTemplateRows.length > 5

    const scheduledCampaigns: ScheduledCampaign[] = scheduledCampaignRows.slice(0, 5).map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        scheduledAt: campaign.scheduledAt,
        isOverdue: campaign.scheduledAt.getTime() < now.getTime(),
    }))
    const upcomingCampaigns: UpcomingCampaign[] = scheduledCampaigns
        .filter((campaign) => !campaign.isOverdue)
        .map((campaign) => ({
            id: campaign.id,
            name: campaign.name,
            scheduledAt: campaign.scheduledAt,
        }))
    const errorCampaigns: ErrorCampaign[] = errorCampaignRows.slice(0, 5)
    const pendingTemplateApprovalList: PendingTemplateApproval[] = pendingTemplateRows.slice(0, 5).map((template) => ({
        templateId: template.id,
        templateTitle: template.title,
    }))

    return {
        allTime,
        last30Days,
        previous30Days,
        pendingTemplateApprovals: pendingTemplateApprovalList.length,
        scheduledCampaigns,
        upcomingCampaigns,
        errorCampaigns,
        pendingTemplateApprovalList,
        hasMoreScheduledCampaigns,
        hasMoreErrorCampaigns,
        hasMorePendingTemplateApprovals,
    }
}