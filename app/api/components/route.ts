import { NextResponse } from "next/server"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { requireAuth } from "@/lib/api-auth"
import { getStorageService } from "@/utils/upload/modules"
import { sanitizeQuery } from "@/utils/sanitizer"
import path from "node:path"
import { readFile } from "node:fs/promises"

// GET /api/components
// Supports: query, page, perPage, userOnly
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

        const where: any = {}
        if (q) {
            where.name = { contains: q, mode: "insensitive" as const }
        }
        if (userOnly) {
            where.userId = auth.userId
        }
        const whereOrUndefined = Object.keys(where).length ? where : undefined

        const [blocks, totalCount] = await Promise.all([
            prisma.componentBlock.findMany({
                where: whereOrUndefined,
                orderBy: { updatedAt: "desc" },
                take: perPage,
                skip: (page - 1) * perPage,
                include: {
                    user: true,
                    versions: { orderBy: { createdAt: "desc" } },
                },
            }),
            prisma.componentBlock.count({ where: whereOrUndefined }),
        ])

        const totalPages = Math.max(0, Math.ceil(totalCount / perPage))

        return NextResponse.json({
            componentBlocks: blocks,
            currentPage: page,
            total: totalPages,
        })
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "Failed to fetch component blocks" },
            { status: 500 }
        )
    }
}

// POST /api/components
// Body: { name, description, content }
export async function POST(req: Request) {
    try {
        const auth = await requireAuth(req)
        if (!auth.ok) return auth.response

        const { userId: uid, businessId } = auth
        if (!uid) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        // Support both legacy JSON content creation and new XML-based creation
        const { name, orientation, widthCm, heightCm } = body || {}

        if (!name || !orientation || !widthCm || !heightCm) {
            return NextResponse.json(
                { error: "Missing any of the following in the body: name, orientation, widthCm, heightCm" },
                { status: 400 }
            )
        }

        if (!uid) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const prisma = await getBusinessPrisma(businessId!)
        const findExistingTemplate = await prisma.componentBlock.findUnique({
            where: { name },
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
        
        const filePath = `${businessId}/componentBlock/${encodeURIComponent(name)}.xml`

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

        const created = await prisma.componentBlock.create({
            data: {
                name: name,
                filePath: fileUrl,
                userId: uid,
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
            { error: err?.message || "Failed to create component block" },
            { status: 500 }
        )
    }
}
