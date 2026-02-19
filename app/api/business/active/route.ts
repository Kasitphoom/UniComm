import prismaMain from "@/lib/prisma-main"
import { authOptions } from "@/lib/auth"
import { DEFAULT_BUSINESS_COOKIE } from "@/types/business"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

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
