import type { PrismaClient } from "../../../../../../app/generated/business/prisma"
import type { BusinessMigration } from "../../../../types"
import { getStorageService } from "../../../../../../utils/upload/modules"

export const migrations: Array<BusinessMigration<PrismaClient>> = [
    {
        name: "delete-existing-campaigns-manually",
        description:
            "Delete all existing campaigns while preserving timed campaign files for metrics (same behavior as campaign DELETE route)",
        up: async ({ prisma, businessId }) => {
            console.log(`[business:${businessId}] Starting campaign cleanup migration...`)

            const campaigns = await prisma.campaign.findMany({
                select: {
                    id: true,
                    files: {
                        select: {
                            id: true,
                            filePath: true,
                            generationStartedAt: true,
                            generationFinishedAt: true,
                        },
                    },
                },
            })

            console.log(`[business:${businessId}] Found ${campaigns.length} campaign(s) to delete`)

            for (const campaign of campaigns) {
                const filesMissingTiming = campaign.files.filter(
                    (file) => !file.generationStartedAt || !file.generationFinishedAt,
                )
                const filesWithTiming = campaign.files.filter(
                    (file) => file.generationStartedAt && file.generationFinishedAt,
                )

                if (filesMissingTiming.length > 0) {
                    const storageService = getStorageService()
                    if (!storageService) {
                        throw new Error(
                            `Storage service not configured; cannot safely delete ${filesMissingTiming.length} campaign file(s) for campaign ${campaign.id}`,
                        )
                    }

                    for (const file of filesMissingTiming) {
                        await storageService.deleteFile(file.filePath)
                        await prisma.campaignFile.delete({
                            where: { id: file.id },
                        })
                    }
                }

                if (filesWithTiming.length > 0) {
                    await prisma.campaignFile.updateMany({
                        where: {
                            id: {
                                in: filesWithTiming.map((file) => file.id),
                            },
                        },
                        data: {
                            campaignId: null,
                        },
                    })
                }

                await prisma.campaign.delete({
                    where: { id: campaign.id },
                })
            }

            console.log(`[business:${businessId}] Campaign cleanup migration completed`)
        },
    },
]
