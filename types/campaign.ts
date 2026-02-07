import type { Prisma } from "@/app/generated/business/prisma"

export type Campaign = Prisma.CampaignGetPayload<{}>

export type CampaignTemplateWithTemplate = Prisma.CampaignTemplateGetPayload<{
    include: {
        template: true
    }
}>

export type CampaignWithRelations = Prisma.CampaignGetPayload<{
    include: {
        templates: {
            include: {
                template: true
            }
        }
        logs: true
    }
}>

export type CampaignListResponse = {
    campaigns: CampaignWithRelations[]
    currentPage: number
    totalPages: number
    totalCount: number
}
