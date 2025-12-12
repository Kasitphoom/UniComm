import { NextResponse } from "next/server"
import { getBusinessPrisma, getBusinessPrismaByCookie } from "@/lib/prisma-business"
import { Template } from "@pdfme/common"
import { transformTemplateToXml } from "@/utils/template/xml-pdf-transformer"
import { requireAuth } from '@/lib/api-auth'
import { getStorageService } from "@/utils/upload/modules"
import { hashTemplate } from "@/lib/draftStore"

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

        const hashedTemplate = await hashTemplate(body)
        const xmlContent = await transformTemplateToXml(body)
        
        const storageService = getStorageService()
        if (!storageService) {
            return NextResponse.json(
                { error: "Storage service not configured" },
                { status: 500 }
            )
        }

        const fileKey = `${auth.businessId!}/templates/${encodeURIComponent(`${id}.${hashedTemplate}`)}.xml`

        const existingVersions = await prisma.templateVersion.findMany({
            where: { templateId: id, version: hashedTemplate },
            orderBy: { version: 'desc' },
            take: 1,
        })

        if (existingVersions.length > 0) {
            const updated = await prisma.templates.update({
                where: { id },
                data: {
                    filePath: existingVersions[0].filePath,
                },
                include: {
                    versions: {
                        where: {
                            version: hashedTemplate,
                        },
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                    }
                }
            })

            return NextResponse.json({ updated, xmlPreview: xmlContent.slice(0, 500) })
        }

        const newUrl = await storageService.uploadFile(Buffer.from(xmlContent, 'utf8'), fileKey)

        const updated = await prisma.templates.update({
            where: { id },
            data: {
                versions: {
                    create: {
                        filePath: newUrl,
                        version: hashedTemplate,
                    },
                },
                filePath: newUrl,
            },
            include: {
                versions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                }
            }
        })

        return NextResponse.json({ updated, xmlPreview: xmlContent.slice(0, 500) })
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "Failed to update template" },
            { status: 500 }
        )
    }
}

export const DELETE = async (
    req: Request,
    context: { params: Promise<{ id: string }> }
) => {
    try {
        const auth = await requireAuth(req)
        if (!auth.ok) return auth.response
        const { id } = await context.params
        const prisma = await getBusinessPrisma(auth.businessId!)

        const existingTemplate = await prisma.templates.findUnique({
            where: { id },
            include: {
                versions: true,
            }
        })
        if (!existingTemplate) {
            return NextResponse.json(
                { error: "Template not found" },
                { status: 404 }
            )
        }

        // Delete associated file from storage
        const storageService = getStorageService()
        if (storageService && existingTemplate.versions.length > 0) {
            for (const version of existingTemplate.versions) {
                await storageService.deleteFile(version.filePath)
            }
        }

        await prisma.templates.delete({
            where: { id },
        })

        return NextResponse.json({ message: "Template deleted" })
    } catch (err: any) {
        console.log(err)
        return NextResponse.json(
            { error: err?.message || "Failed to delete template" },
            { status: 500 }
        )
    }
}