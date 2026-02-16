import prisma from "@/lib/prisma-main"

export const getAllBusinessIds = async (): Promise<string[]> => {
    const prismaMain = await prisma.business.findMany({ select: { id: true } })
    return prismaMain.map((b) => b.id)
}