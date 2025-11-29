import { NextResponse } from "next/server"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { requireAuth } from "@/lib/api-auth"
import { getStorageService } from "@/utils/upload/modules"
import { transformXmlToTemplate } from "@/utils/template/xml-pdf-transformer"

// For components, parser returns the JSON content for latest version
export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const auth = await requireAuth(req)
        if (!auth.ok) return auth.response
        const prisma = await getBusinessPrisma(auth.businessId!)
        const block = await prisma.componentBlock.findUnique({ where: { id: params.id } })
        if (!block) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        const storage = getStorageService()
        if (!storage) return NextResponse.json({ error: 'Storage service not configured' }, { status: 500 })

        const fileContent = await storage.getFileContent(block.filePath)
        const parsedContent = await transformXmlToTemplate(fileContent)
        return NextResponse.json({ data: parsedContent })
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "Failed to parse component block" },
            { status: 500 }
        )
    }
}
