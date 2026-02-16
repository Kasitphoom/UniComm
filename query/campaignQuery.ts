import type { Prisma } from "@/app/generated/business/prisma"
import { getBusinessPrismaByCookie } from "@/lib/prisma-business"
import type { CampaignDetail } from "@/types/campaign"

const campaignDetailInclude = {
    templates: {
        include: {
            template: true,
        },
        orderBy: { createdAt: "asc" },
    },
    contactlist: {
        include: {
            _count: {
                select: { customers: true },
            },
        },
    },
    files: {
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
    },
    logs: {
        orderBy: { createdAt: "desc" },
        take: 100,
    },
} satisfies Prisma.CampaignInclude

export const getCampaignDetail = async (campaignId: string): Promise<CampaignDetail | null> => {
    if (!campaignId) return null
    const prismaBusiness = await getBusinessPrismaByCookie()
    return prismaBusiness.campaign.findUnique({
        where: { id: campaignId },
        include: campaignDetailInclude,
    })
}
