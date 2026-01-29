import { NextRequest, NextResponse } from "next/server"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { sanitizeQuery } from "@/utils/sanitizer"
import { getStorageService } from "@/utils/upload/modules"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { requireAuth } from "@/lib/api-auth"
import { userHasPermissionAPI } from "@/utils/permissions"
import { UserRole } from "@/app/generated/business/prisma"

export async function GET(req: Request) {
    try {
        const auth = await requireAuth(req)
        if (!auth.ok) return auth.response

        const { searchParams } = new URL(req.url)
        const rawQuery = searchParams.get("query") || undefined
        const page = Math.max(
            1,
            parseInt(searchParams.get("page") || "1", 10) || 1
        )
        const perPage = Math.min(
            50,
            Math.max(1, parseInt(searchParams.get("perPage") || "8", 10) || 8)
        )
        const userOnly = searchParams.get("userOnly") === "true"

        const q = sanitizeQuery(rawQuery)
        const prisma = await getBusinessPrisma(auth.businessId!)

        // Build dynamic where clause
        const where: any = {}

        if (q) {
            where.title = {
                contains: q,
                mode: "insensitive" as const,
            }
        }

        if (userOnly) {
            // Require authenticated session to filter by user
            where.userId = auth.userId
        }
        // If no filters applied, use undefined to avoid empty object edge cases
        const whereOrUndefined = Object.keys(where).length ? where : undefined

        const [templates, totalCount] = await Promise.all([
            prisma.templates.findMany({
                where: whereOrUndefined,
                orderBy: { updatedAt: "desc" },
                take: perPage,
                skip: (page - 1) * perPage,
                include: { 
                    user: true,
                    versions: { orderBy: { createdAt: "desc" } },
                    approvers: true
                },
            }),
            prisma.templates.count({ where: whereOrUndefined }),
        ])

        const totalPages = Math.max(0, Math.ceil(totalCount / perPage))

        // Add requireUserApproval field to each template
        const templatesWithApprovalFlag = templates.map(template => ({
            ...template,
            requireUserApproval: template.approvers.some(
                approver => approver.userId === auth.userId
            )
        }))

        return NextResponse.json({
            templates: templatesWithApprovalFlag,
            currentPage: page,
            total: totalPages,
        })
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "Failed to fetch templates" },
            { status: 500 }
        )
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req)
        if (!auth.ok) return auth.response

        const {userId: uid, businessId } = auth

        const hasPermission = await userHasPermissionAPI(req,
            [
                UserRole.ADMIN,
                UserRole.OWNER,
                UserRole.MEMBER,
            ]
        )
        if (!hasPermission) {
            return NextResponse.json(
                { error: "Not Enough Permission" },
                { status: 403 }
            )
        }

        const body = await req.json()
        const {
            templateName,
            orientation,
            widthCm,
            heightCm,
            customerListId,
        } = body || {}

        if (!templateName || !orientation || !widthCm || !heightCm) {
            return NextResponse.json(
                { error: "Missing any of the following in the body: templateName, orientation, widthCm, heightCm" },
                { status: 400 }
            )
        }

        if (!uid) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const prisma = await getBusinessPrisma(businessId!)
        const findExistingTemplate = await prisma.templates.findUnique({
            where: { title: templateName },
        })
        if (findExistingTemplate) {
            return NextResponse.json(
                { error: "Template with the same name already exists" },
                { status: 400 }
            )
        }

        const bu = await prisma.businessUser.findUnique({ where: { id: uid } })
        if (!bu)
            return NextResponse.json(
                { error: "Business user not found" },
                { status: 404 }
            )
        
        const storageService = getStorageService()
        if (!storageService)
            return NextResponse.json(
                { error: "Storage service not configured" },
                { status: 500 }
            )
        
        const filePath = `${businessId}/templates/${encodeURIComponent(templateName)}.xml`

        // Load XML template from local file and inject dimensions
        const templatePath = path.join(process.cwd(), 'app', 'api', 'templates', 'template.xml')
        let xmlContent = await readFile(templatePath, 'utf8')
        // If orientation is landscape, swap width/height logically
        const w = String(widthCm)
        const h = String(heightCm)
        const [finalW, finalH] = orientation === 'landscape' ? [h, w] : [w, h]
        xmlContent = xmlContent
            .replace(/REPLACE_WIDTH/g, finalW)
            .replace(/REPLACE_HEIGHT/g, finalH)

        // Upload to storage
        const fileUrl = await storageService.uploadFile(Buffer.from(xmlContent, 'utf8'), filePath)

        const created = await prisma.templates.create({
            data: {
                title: templateName,
                filePath: fileUrl,
                userId: uid,
                contactListId: customerListId || null,
                versions: {
                    create: {
                        filePath: fileUrl,
                        version: 'initial',
                    }
                }
            },
            include: { user: true, versions: { orderBy: { createdAt: "desc" }, take: 1 }},
        })

        return NextResponse.json(created, { status: 201 })
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "Failed to create template" },
            { status: 500 }
        )
    }
}
