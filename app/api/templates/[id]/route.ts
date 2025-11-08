import { NextResponse } from "next/server"
import { getBusinessPrisma, getBusinessPrismaByCookie } from "@/lib/prisma-business"
import { Template } from "@pdfme/common"
import { transformTemplateToXml } from "@/utils/template/xml-pdf-transformer"
import { requireAuth } from '@/lib/api-auth'
import { getStorageService } from "@/utils/upload/modules"

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

export async function PATCH(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(req)
        if (!auth.ok) return auth.response
        const { id } = await context.params
        const prisma = await getBusinessPrisma(auth.businessId!)
        const body: Template = await req.json()

        const existingTemplate = await prisma.templates.findUnique({
            where: { id },
        })
        if (!existingTemplate) {
            return NextResponse.json(
                { error: "Template not found" },
                { status: 404 }
            )
        }

        const xmlContent = await transformTemplateToXml(body)
        
        const storageService = getStorageService()
        if (!storageService) {
            return NextResponse.json(
                { error: "Storage service not configured" },
                { status: 500 }
            )
        }

        console.log(xmlContent)

        const filePath = `${auth.businessId!}/templates/${encodeURIComponent(existingTemplate.title)}.xml`
        await storageService.uploadFile(Buffer.from(xmlContent), filePath)

        const updated = await prisma.templates.update({
            where: { id },
            data: {
                updatedAt: new Date(),
            },
        })

        return NextResponse.json({ updated, xmlPreview: xmlContent.slice(0, 500) })
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "Failed to update template" },
            { status: 500 }
        )
    }
}
