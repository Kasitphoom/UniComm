import { NextResponse } from "next/server"
import { getBusinessPrisma, getBusinessPrismaByCookie } from "@/lib/prisma-business"
import { sanitizeQuery } from "@/utils/sanitizer"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getStorageService } from "@/utils/upload/modules"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { requireAuth } from "@/lib/api-auth"

export async function GET(req: Request) {
    try {
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

        const q = sanitizeQuery(rawQuery)
        const prisma = await getBusinessPrismaByCookie()

        const where = q
            ? {
                  title: {
                      contains: q,
                      mode: "insensitive" as const,
                  },
              }
            : undefined

        const [templates, totalCount] = await Promise.all([
            prisma.templates.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: perPage,
                skip: (page - 1) * perPage,
                include: { user: true },
            }),
            prisma.templates.count({ where }),
        ])

        const totalPages = Math.max(0, Math.ceil(totalCount / perPage))

        return NextResponse.json({
            templates,
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

export async function POST(req: Request) {
    try {
        const auth = await requireAuth(req)
        if (!auth.ok) return auth.response

        const {userId: uid, businessId } = auth

        const body = await req.json()
        const {
            templateName,
            orientation,
            widthCm,
            heightCm,
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
                versions: {
                    create: {
                        filePath: filePath,
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
