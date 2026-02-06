import { APPROVAL_STATUS } from "@/app/generated/business/prisma"
import { requireAuth } from "@/lib/api-auth"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { NextRequest, NextResponse } from "next/server"

export const PATCH = async (
    req: NextRequest,
    context: { params: Promise<{ id: string; approvalId: string }> },
) => {
    try {
        const auth = await requireAuth(req)
        if (!auth.ok) return auth.response
        if (!auth.userId)
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            )

        const { id, approvalId } = await context.params
        const prisma = await getBusinessPrisma(auth.businessId!)
        const body: { status?: string } = await req.json()

        const normalizedStatus =
            typeof body.status === "string"
                ? (body.status.toUpperCase() as APPROVAL_STATUS)
                : undefined

        const allowedStatuses = new Set(Object.values(APPROVAL_STATUS))
        if (!normalizedStatus || !allowedStatuses.has(normalizedStatus)) {
            return NextResponse.json(
                {
                    error:
                        "Invalid status",
                },
                { status: 400 },
            )
        }

        const approval = await prisma.approver.findUnique({
            where: { id: approvalId },
            include: { user: true },
        })

        if (!approval || approval.templateId !== id) {
            return NextResponse.json(
                { error: "Approval not found" },
                { status: 404 },
            )
        }

        if (approval.userId !== auth.userId) {
            return NextResponse.json(
                { error: "Not authorized to update this approval" },
                { status: 403 },
            )
        }

        const updatedApproval = await prisma.approver.update({
            where: { id: approvalId },
            data: { status: normalizedStatus },
            include: { user: true },
        })

        return NextResponse.json(updatedApproval)
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "Failed to update approval status" },
            { status: 500 },
        )
    }
}
