import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { userHasPermissionAPI } from "@/utils/permissions"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { UserRole } from "@/app/generated/business/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteParams = {
    params: Promise<{ jobId: string }>
}

export const DELETE = async (req: NextRequest, { params }: RouteParams) => {
    try {
        const auth = await requireAuth(req)
        if (!auth.ok) return auth.response

        const businessId = auth.businessId
        if (!businessId) {
            return NextResponse.json({ error: "No active business selected" }, { status: 400 })
        }

        const hasPermission = await userHasPermissionAPI(req, [
            UserRole.OWNER,
            UserRole.ADMIN,
            UserRole.MEMBER,
        ])

        if (!hasPermission) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
        }

        const { jobId } = await params
        if (!jobId?.trim()) {
            return NextResponse.json({ error: "jobId is required" }, { status: 400 })
        }

        const prisma = getBusinessPrisma(businessId)
        const result = await (prisma as any).campaignChunkFile.updateMany({
            where: {
                jobId,
                isDeleted: false,
            },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
            },
        })

        return NextResponse.json({
            ok: true,
            jobId,
            markedDeleted: Number(result?.count ?? 0),
        })
    } catch (error) {
        console.error("Error deleting campaign chunk files:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 },
        )
    }
}
