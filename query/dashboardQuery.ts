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
    fileWhere?: Prisma.CampaignFileWhereInput
}

const getProcessingStats = async ({ campaignWhere = {}, fileWhere = {} }: StatsQuery = {}): Promise<PerformanceStats> => {
    const prismaBusiness = await getBusinessPrismaByCookie()

    const [aggregateResult, failedCampaigns, generatedFiles] = await Promise.all([
        prismaBusiness.campaign.aggregate({
            where: campaignWhere,
            _count: {
                id: true,
            },
        }),
        prismaBusiness.campaign.count({
            where: {
                ...campaignWhere,
                scheduleStatus: "FAILED",
            },
        }),
        prismaBusiness.campaignFile.findMany({
            where: {
                ...fileWhere,
                generationStartedAt: {
                    not: null,
                },
                generationFinishedAt: {
                    not: null,
                },
            },
            select: {
                generatedDocuments: true,
                generationStartedAt: true,
                generationFinishedAt: true,
                campaign: {
                    select: {
                        totalRecords: true,
                    },
                },
            },
        }),
    ])

    const documentsGenerated = generatedFiles.reduce((acc, file) => {
        const fallbackDocuments = file.campaign?.totalRecords ?? 0
        const generatedDocuments = file.generatedDocuments > 0 ? file.generatedDocuments : fallbackDocuments
        return acc + generatedDocuments
    }, 0)

    const totalCampaigns = aggregateResult._count.id ?? 0
    const safeTotalCampaigns = totalCampaigns === 0 ? 1 : totalCampaigns
    const errorRate = (failedCampaigns / safeTotalCampaigns) * 100

    const totalProcessingSeconds = generatedFiles.reduce((acc, file) => {
        if (!file.generationStartedAt || !file.generationFinishedAt) return acc
        const durationMs = file.generationFinishedAt.getTime() - file.generationStartedAt.getTime()
        if (durationMs <= 0) return acc
        return acc + durationMs / 1000
    }, 0)

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

const getDateWindowFileWhere = ({ from, to }: DateWindow): Prisma.CampaignFileWhereInput => {
    return {
        generationFinishedAt: {
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
            fileWhere: getDateWindowFileWhere({ from: thirtyDaysAgo, to: now }),
        }),
        getProcessingStats({
            campaignWhere: getDateWindowWhere({ from: sixtyDaysAgo, to: thirtyDaysAgo }),
            fileWhere: getDateWindowFileWhere({ from: sixtyDaysAgo, to: thirtyDaysAgo }),
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