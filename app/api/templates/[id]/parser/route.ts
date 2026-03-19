import authOptions from "@/lib/auth"
import { getBusinessPrismaByCookie } from "@/lib/prisma-business"
import { Schema } from "@pdfme/common"
import { transformXmlToTemplate } from "@/utils/template/xml-pdf-transformer"
import { getStorageService } from "@/utils/upload/modules"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

/**
 * @swagger
 * /api/templates/{id}/parser:
 *   get:
 *     summary: Parse template XML into JSON template payload
 *     tags:
 *       - Templates
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template parsed successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Template not found
 *       500:
 *         description: Failed to fetch template
 */
export const GET = async (request: Request, context: { params: Promise<{ id: string }> }) => {
    try {
        const { id } = await context.params

        const session = await getServerSession(authOptions)
        if (!session)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        
        const prisma = await getBusinessPrismaByCookie()
        const template = await prisma.templates.findUnique({
            where: { id },
        })

        if (!template)
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        
        // get file xml file from template.filePath
        const storageService = getStorageService()
        if (!storageService)
            return NextResponse.json(
                { error: "Storage service not configured" },
                { status: 500 }
            )

        const fileContent = await storageService.getFileContent(template.filePath)

        const resolveComponentSchemas = (() => {
            const cache = new Map<string, Schema[] | null>()

            return async (componentName: string) => {
                const normalized = componentName.trim()
                if (!normalized) return null
                if (cache.has(normalized)) return cache.get(normalized) ?? null

                const componentBlock = await prisma.componentBlock.findUnique({
                    where: { name: normalized },
                })
                if (!componentBlock?.filePath) {
                    cache.set(normalized, null)
                    return null
                }

                const xmlContent = await storageService.getFileContent(componentBlock.filePath)
                const parsed = await transformXmlToTemplate(xmlContent, { resolveComponentSchemas })
                const firstPage = parsed.schemas?.[0]
                const result = Array.isArray(firstPage) ? firstPage : null
                cache.set(normalized, result)
                return result
            }
        })()

        const parsedContent = await transformXmlToTemplate(fileContent, { resolveComponentSchemas })

        return NextResponse.json({
            data: parsedContent,
        })

    } catch (err: any) {
        console.log(err)
        return NextResponse.json(
            { error: err?.message || "Failed to fetch template" },
            { status: 500 }
        )
    }
}