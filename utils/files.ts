import { getBusinessPrisma } from "@/lib/prisma-business";
import { getAllBusinessIds } from "./business";
import { getStorageService } from "./upload/modules";
import { FILE_STATUS, SCHEDULE_STATUS } from "@/app/generated/business/prisma";

const MAX_DB_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const deleteCampaignFileJob = async () => {
    const currentTime = new Date();
    currentTime.setSeconds(0, 0)

    const allBusinessIds = await getAllBusinessIds()
    const storageProvider = getStorageService()

    if (!storageProvider) {
        console.warn("deleteCampaignFileJob: storage provider is not configured, skipping run")
        return
    }

    for (const businessId of allBusinessIds) {
        let attempt = 0;
        let processed = false;

        while (!processed && attempt < MAX_DB_RETRIES) {
            attempt += 1;
            const prisma = getBusinessPrisma(businessId);
            const attemptLabel = `${businessId} (attempt ${attempt}/${MAX_DB_RETRIES})`;

            try {
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
                    try {
                        await storageProvider.deleteFile(file.filePath)
                        await prisma.campaignFile.update({
                            where: { id: file.id },
                            data: { isDeleted: true, status: FILE_STATUS.EXPIRED },
                        })

                        await prisma.campaign.update({
                            where: { id: file.campaignId || undefined },
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

                processed = true
            } catch (error) {
                console.error(`deleteCampaignFileJob: failed to process business ${attemptLabel}`, error)
                if (attempt < MAX_DB_RETRIES) {
                    const waitMs = RETRY_DELAY_MS * attempt
                    console.warn(`Retrying business ${businessId} in ${waitMs}ms due to previous error`)
                    await delay(waitMs)
                }
            } finally {
                await prisma.$disconnect().catch((disconnectError) => {
                    console.warn(`deleteCampaignFileJob: failed to disconnect Prisma for business ${businessId}`, disconnectError)
                })
            }
        }

        if (!processed) {
            console.error(`deleteCampaignFileJob: giving up after ${MAX_DB_RETRIES} attempts for business ${businessId}`)
        }
    }
}