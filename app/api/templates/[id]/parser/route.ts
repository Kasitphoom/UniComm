import authOptions from "@/lib/auth"
import { getBusinessPrismaByCookie } from "@/lib/prisma-business"
import { transformXmlToTemplate } from "@/utils/template/xml-pdf-transformer"
import { getStorageService } from "@/utils/upload/modules"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

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
        
        const parsedContent = await transformXmlToTemplate(fileContent)

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