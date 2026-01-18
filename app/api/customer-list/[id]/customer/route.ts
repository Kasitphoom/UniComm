import { requireAuth } from "@/lib/api-auth"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { NextRequest, NextResponse } from "next/server"

export const DELETE = async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) => {
    try {
        const auth = await requireAuth(request)
        if (!auth.ok) return auth.response

        const prisma = await getBusinessPrisma(auth.businessId!)

        if (!prisma) {
            return NextResponse.json(
                { error: "Business database not found." },
                { status: 404 },
            )
        }

        const { id } = await context.params
        const { ids } = await request.json() as { ids: string[] }

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                { error: "No customer IDs provided." },
                { status: 400 },
            )
        }

        await prisma.customer.deleteMany({
            where: { id: { in: ids }, listId: id },
        })

        return NextResponse.json(
            { message: "Contact list deleted successfully." },
            { status: 200 },
        )
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to delete contact list." },
            { status: 500 },
        )
    }
}
