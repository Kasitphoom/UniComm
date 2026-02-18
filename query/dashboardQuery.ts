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

type DateWindow = {
    from: Date
    to: Date
}

const getProcessingStats = async (where: Prisma.CampaignWhereInput = {}): Promise<PerformanceStats> => {
    const prismaBusiness = await getBusinessPrismaByCookie()

    const [aggregateResult, failedCampaigns, durations] = await Promise.all([
        prismaBusiness.campaign.aggregate({
            where,
            _count: {
                id: true,
            },
            _sum: {
                totalRecords: true,
            },
        }),
        prismaBusiness.campaign.count({
            where: {
                ...where,
                scheduleStatus: "FAILED",
            },
        }),
        prismaBusiness.campaign.findMany({
            where: {
                ...where,
                executedAt: {
                    not: null,
                },
            },
            select: {
                totalRecords: true,
                scheduledAt: true,
                executedAt: true,
            },
        }),
    ])

    const documentsGenerated = aggregateResult._sum.totalRecords ?? 0
    const totalCampaigns = aggregateResult._count.id ?? 0
    const safeTotalCampaigns = totalCampaigns === 0 ? 1 : totalCampaigns
    const errorRate = (failedCampaigns / safeTotalCampaigns) * 100

    const totalProcessingMinutes = durations.reduce((acc, campaign) => {
        if (!campaign.executedAt) return acc
        const durationMs = campaign.executedAt.getTime() - campaign.scheduledAt.getTime()
        if (durationMs <= 0) return acc
        return acc + durationMs / 60000
    }, 0)

    const processingSpeed = totalProcessingMinutes > 0 ? documentsGenerated / totalProcessingMinutes : 0

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

export const getDashboardPerformanceStats = async (currentUserId?: string) => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(now.getDate() - 30)

    const sixtyDaysAgo = new Date(now)
    sixtyDaysAgo.setDate(now.getDate() - 60)

    const prismaBusiness = await getBusinessPrismaByCookie()

    const [allTime, last30Days, previous30Days, upcomingCampaignRows, pendingTemplateRows] = await Promise.all([
        getProcessingStats(),
        getProcessingStats(getDateWindowWhere({ from: thirtyDaysAgo, to: now })),
        getProcessingStats(getDateWindowWhere({ from: sixtyDaysAgo, to: thirtyDaysAgo })),
        prismaBusiness.campaign.findMany({
            where: {
                scheduleStatus: "PENDING",
                scheduledAt: {
                    gte: now,
                },
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

    const hasMoreUpcomingCampaigns = upcomingCampaignRows.length > 5
    const hasMorePendingTemplateApprovals = pendingTemplateRows.length > 5

    const upcomingCampaigns: UpcomingCampaign[] = upcomingCampaignRows.slice(0, 5)
    const pendingTemplateApprovalList: PendingTemplateApproval[] = pendingTemplateRows.slice(0, 5).map((template) => ({
        templateId: template.id,
        templateTitle: template.title,
    }))

    return {
        allTime,
        last30Days,
        previous30Days,
        pendingTemplateApprovals: pendingTemplateApprovalList.length,
        upcomingCampaigns,
        pendingTemplateApprovalList,
        hasMoreUpcomingCampaigns,
        hasMorePendingTemplateApprovals,
    }
}