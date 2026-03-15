import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getBusinessPrisma } from "@/lib/prisma-business";
import { sanitizeQuery } from "@/utils/sanitizer";

/**
 * @swagger
 * /api/business/users:
 *   get:
 *     summary: List users in the active business
 *     tags:
 *       - Business
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         required: false
 *         description: Search by email or display name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         required: false
 *         description: Page number (default 1)
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *         required: false
 *         description: Items per page (default 10, max 50)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         required: false
 *         description: Sort order for displayName
 *     responses:
 *       200:
 *         description: Users fetched successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to fetch business users
 */
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
        const sort = (searchParams.get("sort") || "desc") as "asc" | "desc";

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
                orderBy: { displayName: sort },
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
