import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/business/prisma"
import { requireAuth } from "@/lib/api-auth"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { userHasPermissionAPI } from "@/utils/permissions"
import { refreshTemplateDependencies } from "@/utils/template/refreshTemplateDependencies"

export const POST = async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) => {
    try {
        const auth = await requireAuth(request)
        if (!auth.ok) return auth.response
        if (!auth.businessId) {
            return NextResponse.json(
                { error: "No active business selected" },
                { status: 400 },
            )
        }

        const hasPermission = await userHasPermissionAPI(request, [
            UserRole.OWNER,
            UserRole.ADMIN,
            UserRole.MEMBER,
        ])
        if (!hasPermission) {
            return NextResponse.json(
                { error: "Insufficient permissions" },
                { status: 403 },
            )
        }

        const { id } = await context.params
        if (!id) {
            return NextResponse.json(
                { error: "Template ID is required" },
                { status: 400 },
            )
        }

        const prisma = await getBusinessPrisma(auth.businessId)
        const refreshedTemplate = await refreshTemplateDependencies({
            prisma,
            templateId: id,
            businessId: auth.businessId,
        })

        if (!refreshedTemplate) {
            return NextResponse.json(
                { error: "Template not found" },
                { status: 404 },
            )
        }

        return NextResponse.json(refreshedTemplate)
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || "Failed to refresh template dependencies" },
            { status: 500 },
        )
    }
}
