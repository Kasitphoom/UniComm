import { NextResponse } from "next/server"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { requireAuth } from "@/lib/api-auth"
import { getStorageService } from "@/utils/upload/modules"
import { Schema } from "@pdfme/common"
import { transformXmlToTemplate } from "@/utils/template/xml-pdf-transformer"

// For components, parser returns the JSON content for latest version
export async function GET(
    request: Request, context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params

        const auth = await requireAuth(request)
        if (!auth.ok) return auth.response
        const prisma = await getBusinessPrisma(auth.businessId!)
        const block = await prisma.componentBlock.findUnique({ where: { id } })
        if (!block) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        const storage = getStorageService()
        if (!storage) return NextResponse.json({ error: 'Storage service not configured' }, { status: 500 })

        const fileContent = await storage.getFileContent(block.filePath)

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

                const xmlContent = await storage.getFileContent(componentBlock.filePath)
                const parsed = await transformXmlToTemplate(xmlContent, { resolveComponentSchemas })
                const firstPage = parsed.schemas?.[0]
                const result = Array.isArray(firstPage) ? firstPage : null
                cache.set(normalized, result)
                return result
            }
        })()

        const parsedContent = await transformXmlToTemplate(fileContent, { resolveComponentSchemas })
        return NextResponse.json({ data: parsedContent })
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "Failed to parse component block" },
            { status: 500 }
        )
    }
}
