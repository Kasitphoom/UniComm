import { UserRole } from "@/app/generated/business/prisma"
import { requireAuth } from "@/lib/api-auth"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { userHasPermissionAPI } from "@/utils/permissions"
import { NextRequest, NextResponse } from "next/server"

export const PATCH = async (
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    try {
        const auth = await requireAuth(req)
        if (!auth.ok) return auth.response

        const { id } = await context.params
        const prisma = await getBusinessPrisma(auth.businessId!)
        const body: { approvers: string[] } = await req.json()

        const existingTemplate = await prisma.templates.findUnique({
            where: { id },
        })
        if (!existingTemplate) {
            return NextResponse.json(
                { error: "Template not found" },
                { status: 404 }
            )
        }
        
        const hasPermission = await userHasPermissionAPI(req,
            [
                UserRole.OWNER,
                UserRole.ADMIN,
                UserRole.MEMBER,
            ]
        )

        if ((existingTemplate.userId !== auth.userId) || !hasPermission) {
            return NextResponse.json(
                { error: "Not authorized to update this template" },
                { status: 403 }
            )
        }

        const existingApproval = await prisma.approver.findMany({
            where: { templateId: id }
        })

        const approvalIdsToDelete = existingApproval
            .filter(approval => !body.approvers.includes(approval.userId))
            .map(approval => approval.id)
        
        const approvalIdsToCreate = body.approvers.filter(
            userId => !existingApproval.some(approval => approval.userId === userId)
        )

        const updatedApproval = await prisma.templates.update({
            where:{ id },
            data: {
                approvers: {
                    deleteMany: { id: { in: approvalIdsToDelete } },
                    create: approvalIdsToCreate.map(userId => ({
                        user: { connect: { id: userId } }
                    }))
                }
            },
            include: { approvers: true }
        })

        return NextResponse.json(updatedApproval)
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "Failed to update approval status" },
            { status: 500 }
        )
    }
}