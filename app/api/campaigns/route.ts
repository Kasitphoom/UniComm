import { NextResponse } from "next/server"
import { Prisma, FILE_STATUS, SCHEDULE_STATUS } from "@/app/generated/business/prisma"
import { requireAuth } from "@/lib/api-auth"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { sanitizeQuery } from "@/utils/sanitizer"

const MAX_PER_PAGE = 50
const DEFAULT_PER_PAGE = 10

type EnumLike = string

function parseEnumFilters<T extends EnumLike>(
    rawValues: string[],
    allowedValues: readonly T[],
): T[] {
    if (!rawValues.length) return []

    const normalizedToActual = new Map<string, T>(
        allowedValues.map((value) => [value.toUpperCase(), value]),
    )
    const deduped = new Set<T>()

    rawValues
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((value) => {
            const match = normalizedToActual.get(value.toUpperCase())
            if (match) deduped.add(match)
        })

    return Array.from(deduped)
}

export async function GET(req: Request) {
    try {
        const auth = await requireAuth(req)
        if (!auth.ok) return auth.response
        if (!auth.businessId) {
            return NextResponse.json(
                { error: "No active business selected" },
                { status: 400 },
            )
        }

        const { searchParams } = new URL(req.url)
        const rawQuery = searchParams.get("query") || undefined
        const q = sanitizeQuery(rawQuery)

        const page = Math.max(
            1,
            parseInt(searchParams.get("page") || "1", 10) || 1,
        )
        const perPage = Math.min(
            MAX_PER_PAGE,
            Math.max(
                1,
                parseInt(searchParams.get("perPage") || String(DEFAULT_PER_PAGE), 10) ||
                    DEFAULT_PER_PAGE,
            ),
        )

        const fileStatusFilters = parseEnumFilters<FILE_STATUS>(
            searchParams.getAll("status"),
            Object.values(FILE_STATUS) as FILE_STATUS[],
        )
        const scheduleStatusFilters = parseEnumFilters<SCHEDULE_STATUS>(
            searchParams.getAll("scheduleStatus"),
            Object.values(SCHEDULE_STATUS) as SCHEDULE_STATUS[],
        )

        const prisma = await getBusinessPrisma(auth.businessId)

        const whereClauses: Prisma.CampaignWhereInput[] = []
        if (q) {
            whereClauses.push({
                OR: [
                    {
                        name: {
                            contains: q,
                            mode: "insensitive",
                        },
                    },
                    {
                        templates: {
                            some: {
                                template: {
                                    title: {
                                        contains: q,
                                        mode: "insensitive",
                                    },
                                },
                            },
                        },
                    },
                ],
            })
        }

        if (fileStatusFilters.length) {
            whereClauses.push({
                fileStatus: {
                    in: fileStatusFilters,
                },
            })
        }

        if (scheduleStatusFilters.length) {
            whereClauses.push({
                scheduleStatus: {
                    in: scheduleStatusFilters,
                },
            })
        }

        const where = whereClauses.length ? { AND: whereClauses } : undefined
        const skip = (page - 1) * perPage

        const [campaigns, totalCount] = await Promise.all([
            prisma.campaign.findMany({
                where,
                orderBy: { scheduledAt: "desc" },
                take: perPage,
                skip,
                include: {
                    templates: {
                        include: {
                            template: true,
                        },
                        orderBy: { createdAt: "asc" },
                    },
                    logs: {
                        orderBy: { createdAt: "desc" },
                        take: 5,
                    },
                },
            }),
            prisma.campaign.count({ where }),
        ])

        const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / perPage)

        return NextResponse.json({
            campaigns,
            currentPage: page,
            totalPages,
            totalCount,
        })
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || "Failed to fetch campaigns" },
            { status: 500 },
        )
    }
}
