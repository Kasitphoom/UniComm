import { getBusinessPrismaByCookie } from "@/lib/prisma-business"
import { sanitizeQuery } from "@/utils/sanitizer"

export const getTemplateWithPagination = async (query: string, currentPage: number = 1, itemsPerPage: number = 8) => {

    const prismaBusiness = await getBusinessPrismaByCookie()
    const q = sanitizeQuery(query)

    const templates = await prismaBusiness.templates.findMany({
        where: q ? {
            title: {
                contains: q,
                mode: 'insensitive',
            },
        } : undefined,
        take: itemsPerPage,
        skip: (currentPage - 1) * itemsPerPage,
        orderBy: {
            createdAt: 'desc',
        },
    })

    const total = await prismaBusiness.templates.count({
        where: q ? {
            title: {
                contains: q,
                mode: 'insensitive',
            },
        } : undefined,
    })

    const totalPages = Math.ceil(total / itemsPerPage)
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages
    }

    return {
        templates,
        currentPage,
        total: totalPages,
    }
}

export const getTemplateByUserId = async (userId?: string, itemsPerPage: number = 8) => {
    if (!userId) return []
    const prismaBusiness = await getBusinessPrismaByCookie()

    const templates = await prismaBusiness.templates.findMany({
        where: {
            userId: userId,
        },
        take: itemsPerPage,
        orderBy: {
            createdAt: 'desc',
        },
        include: {
            user: true,
        },
    })

    return templates
}