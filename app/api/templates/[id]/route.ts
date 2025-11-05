import { NextResponse } from "next/server"
import { getBusinessPrismaByCookie } from "@/lib/prisma-business"

export async function GET(
    _req: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params
        const prisma = await getBusinessPrismaByCookie()
        const tpl = await prisma.templates.findUnique({
            where: { id },
            include: { user: true },
        })
        if (!tpl)
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        return NextResponse.json(tpl)
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "Failed to fetch template" },
            { status: 500 }
        )
    }
}
