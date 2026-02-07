import { NextResponse } from "next/server"
import { Prisma, FILE_STATUS, SCHEDULE_STATUS } from "@/app/generated/business/prisma"
import { requireAuth } from "@/lib/api-auth"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { sanitizeQuery } from "@/utils/sanitizer"

const MAX_PER_PAGE = 50
const DEFAULT_PER_PAGE = 10

type EnumLike = string

type DateRange = {
    start: Date
    end: Date
}

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

function startOfDayUTC(date: Date) {
    const adjusted = new Date(date)
    adjusted.setUTCHours(0, 0, 0, 0)
    return adjusted
}

function endOfDayUTC(date: Date) {
    const adjusted = new Date(date)
    adjusted.setUTCHours(23, 59, 59, 999)
    return adjusted
}

function toDate(value: string | null): Date | null {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function resolveDateRange(
    rangeValue: string | null,
    startDateParam: string | null,
    endDateParam: string | null,
): DateRange | null {
    const normalizedRange = (rangeValue || "ALL").toUpperCase()
    const nowUtc = new Date()

    switch (normalizedRange) {
        case "TODAY":
            return {
                start: startOfDayUTC(nowUtc),
                end: endOfDayUTC(nowUtc),
            }
        case "LAST_7_DAYS": {
            const end = endOfDayUTC(nowUtc)
            const start = startOfDayUTC(new Date(end))
            start.setUTCDate(start.getUTCDate() - 6)
            return { start, end }
        }
        case "THIS_MONTH": {
            const year = nowUtc.getUTCFullYear()
            const month = nowUtc.getUTCMonth()
            const start = startOfDayUTC(new Date(Date.UTC(year, month, 1)))
            const end = endOfDayUTC(new Date(Date.UTC(year, month + 1, 0)))
            return { start, end }
        }
        case "CUSTOM": {
            const start = toDate(startDateParam)
            const end = toDate(endDateParam)
            if (!start || !end || start > end) return null
            return { start, end }
        }
        default:
            return null
    }
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
            searchParams.getAll("fileStatus"),
            Object.values(FILE_STATUS) as FILE_STATUS[],
        )
        const scheduleStatusFilters = parseEnumFilters<SCHEDULE_STATUS>(
            searchParams.getAll("scheduleStatus"),
            Object.values(SCHEDULE_STATUS) as SCHEDULE_STATUS[],
        )
        const dateRangeFilter = resolveDateRange(
            searchParams.get("range"),
            searchParams.get("startDate"),
            searchParams.get("endDate"),
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

        if (dateRangeFilter) {
            whereClauses.push({
                scheduledAt: {
                    gte: dateRangeFilter.start,
                    lte: dateRangeFilter.end,
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
