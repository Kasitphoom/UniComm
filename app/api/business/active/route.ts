import prismaMain from "@/lib/prisma-main"
import { authOptions } from "@/lib/auth"
import { DEFAULT_BUSINESS_COOKIE } from "@/types/business"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

/**
 * @swagger
 * /api/business/active:
 *   post:
 *     summary: Set active business for current user
 *     tags:
 *       - Business
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - businessId
 *             properties:
 *               businessId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Active business set successfully
 *       400:
 *         description: businessId is missing
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User is not a member of the business
 *       500:
 *         description: Failed to set active business
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const userId = (session?.user as any)?.id as string | undefined

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json().catch(() => ({}))
        const businessId = (body?.businessId as string | undefined)?.trim()

        if (!businessId) {
            return NextResponse.json({ error: "businessId is required" }, { status: 400 })
        }

        const membership = await prismaMain.usersOnBusinesses.findFirst({
            where: {
                userId,
                businessId,
            },
            select: {
                businessId: true,
            },
        })

        if (!membership) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const response = NextResponse.json({ ok: true, businessId }, { status: 200 })
        response.cookies.set({
            name: DEFAULT_BUSINESS_COOKIE,
            value: businessId,
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
            sameSite: "lax",
        })

        return response
    } catch (error) {
        return NextResponse.json(
            {
                error: "Unable to set active business",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        )
    }
}
