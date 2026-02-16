import { getBusinessPrisma } from "@/lib/prisma-business";
import { getAllBusinessIds } from "./business";
import { getStorageService } from "./upload/modules";
import { FILE_STATUS, SCHEDULE_STATUS } from "@/app/generated/business/prisma";

export const deleteCampaignFileJob = async () => {
    const currentTime = new Date();
    currentTime.setSeconds(0, 0)

    const allBusinessIds = await getAllBusinessIds()

    for (const businessId of allBusinessIds) {
        const prisma = getBusinessPrisma(businessId)
        const files = await prisma.campaignFile.findMany({
            where: {
                expiresAt: {
                    lte: currentTime,
                },
                isDeleted: false,
            },
        })

        console.log(`Deleting ${files.length} expired file(s) for business ${businessId}`)
        for (const file of files) {
            const storageProvider = getStorageService()
            try {
                await storageProvider.deleteFile(file.filePath)
                await prisma.campaignFile.update({
                    where: { id: file.id },
                    data: { isDeleted: true, status: FILE_STATUS.EXPIRED },
                })

                await prisma.campaign.update({
                    where: { id: file.campaignId },
                    data: {
                        logs: {
                            create: {
                                message: `File ${file.fileName} (${file.filePath}) has been deleted due to expiration.`,
                                status: SCHEDULE_STATUS.TRIGGERED,
                            }
                        }
                    }
                })
            }
            catch (error) {
                console.error(`Failed to delete file ${file.filePath} for business ${businessId}:`, error)
            }
        }
    }
}