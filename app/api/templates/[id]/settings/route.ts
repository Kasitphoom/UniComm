import { Templates, UserRole } from "@/app/generated/business/prisma";
import { requireAuth } from "@/lib/api-auth";
import { getBusinessPrisma } from "@/lib/prisma-business";
import { userHasPermissionAPI } from "@/utils/permissions";
import { NextRequest, NextResponse } from "next/server";

export const PATCH = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
        const auth = await requireAuth(request)
        if (!auth.ok) return auth.response

        const { id } = await context.params
        const prisma = await getBusinessPrisma(auth.businessId!)
        const body: Templates = await request.json()

        const existingTemplate = await prisma.templates.findUnique({
            where: { id },
        })
        if (!existingTemplate) {
            return NextResponse.json(
                { error: "Template not found" },
                { status: 404 }
            )
        }

        const isTemplateOwner = existingTemplate.userId === auth.userId
        const hasPermission = await userHasPermissionAPI(request, [
            UserRole.OWNER,
            UserRole.ADMIN,
            UserRole.MEMBER,
        ]);
        if (!isTemplateOwner || !hasPermission) {
            return NextResponse.json(
                { error: "You do not have permission to update this template" },
                { status: 403 }
            )
        }

        const updatedTemplate = await prisma.templates.update({
            where: { id },
            data: {
                title: body.title,
                contactListId: body.contactListId,
            },
        })

        return NextResponse.json(updatedTemplate)
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "Failed to update template" },
            { status: 500 }
        )
    }
}