import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getBusinessPrisma } from "@/lib/prisma-business";
import { sanitizeQuery } from "@/utils/sanitizer";

export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        if (!auth.ok) return auth.response;

        const { searchParams } = new URL(req.url);
        const rawQuery = searchParams.get("query") || undefined;
        const page = Math.max(
            1,
            parseInt(searchParams.get("page") || "1", 10) || 1
        );
        const perPage = Math.min(
            50,
            Math.max(1, parseInt(searchParams.get("perPage") || "10", 10) || 10)
        );

        const q = sanitizeQuery(rawQuery);
        const prisma = await getBusinessPrisma(auth.businessId!);

        // Build dynamic where clause
        const where: any = {};

        if (q) {
            where.OR = [
                {
                    email: {
                        contains: q,
                        mode: "insensitive" as const,
                    },
                },
                {
                    displayName: {
                        contains: q,
                        mode: "insensitive" as const,
                    },
                },
            ];
        }

        const whereOrUndefined = Object.keys(where).length ? where : undefined;

        const [users, totalCount] = await Promise.all([
            prisma.businessUser.findMany({
                where: whereOrUndefined,
                orderBy: { createdAt: "desc" },
                take: perPage,
                skip: (page - 1) * perPage,
                select: {
                    id: true,
                    email: true,
                    displayName: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
            prisma.businessUser.count({ where: whereOrUndefined }),
        ]);

        const totalPages = Math.max(0, Math.ceil(totalCount / perPage));

        return NextResponse.json({
            users,
            currentPage: page,
            totalPages,
            totalCount,
        });
    } catch (err: any) {
        console.error("Error fetching business users:", err);
        return NextResponse.json(
            { error: err?.message || "Failed to fetch business users" },
            { status: 500 }
        );
    }
}
