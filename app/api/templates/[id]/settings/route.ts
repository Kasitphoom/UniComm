import { UserRole } from "@/app/generated/business/prisma";
import { requireAuth } from "@/lib/api-auth";
import { getBusinessPrisma } from "@/lib/prisma-business";
import { userHasPermissionAPI } from "@/utils/permissions";
import { transformTemplateToXml, transformXmlToTemplate } from "@/utils/template/xml-pdf-transformer";
import { getStorageService } from "@/utils/upload/modules";
import { hashTemplate } from "@/lib/draftStore";
import { NextRequest, NextResponse } from "next/server";

export const PATCH = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    try {
        const auth = await requireAuth(request)
        if (!auth.ok) return auth.response

        const { id } = await context.params
        const prisma = await getBusinessPrisma(auth.businessId!)
        const body = (await request.json()) as {
            title?: string
            paperSize?: "custom" | "a4" | "letter" | "legal"
            orientation?: "portrait" | "landscape"
            widthCm?: string
            heightCm?: string
        }

        const title = body.title?.trim()
        const orientation = body.orientation
        const widthCm = parseFloat(String(body.widthCm))
        const heightCm = parseFloat(String(body.heightCm))

        if (!title || !orientation || !Number.isFinite(widthCm) || !Number.isFinite(heightCm) || widthCm <= 0 || heightCm <= 0) {
            return NextResponse.json(
                {
                    error: "Missing or invalid values for title, orientation, widthCm, or heightCm",
                },
                { status: 400 },
            )
        }

        const existingTemplate = await prisma.templates.findUnique({
            where: { id },
        })
        if (!existingTemplate) {
            return NextResponse.json(
                { error: "Template not found" },
                { status: 404 }
            )
        }

        const isTemplateOwner = existingTemplate.userId === auth.userId
        const hasPermission = await userHasPermissionAPI(request, [
            UserRole.OWNER,
            UserRole.ADMIN,
            UserRole.MEMBER,
        ]);
        if (!isTemplateOwner && !hasPermission) {
            return NextResponse.json(
                { error: "You do not have permission to update this template" },
                { status: 403 }
            )
        }

        const storageService = getStorageService()
        if (!storageService) {
            return NextResponse.json(
                { error: "Storage service not configured" },
                { status: 500 },
            )
        }

        const xmlContent = await storageService.getFileContent(existingTemplate.filePath)
        const parsedTemplate = await transformXmlToTemplate(xmlContent)

        const widthMm = widthCm * 10
        const heightMm = heightCm * 10
        const [finalWidthMm, finalHeightMm] = orientation === "landscape"
            ? [heightMm, widthMm]
            : [widthMm, heightMm]

        parsedTemplate.basePdf = {
            width: finalWidthMm,
            height: finalHeightMm,
            padding: [10, 10, 10, 10],
        }

        const hashedTemplate = await hashTemplate(parsedTemplate)
        const { xml: updatedXmlContent, variables } = await transformTemplateToXml(parsedTemplate)
        const fileKey = `${auth.businessId!}/templates/${encodeURIComponent(`${id}.${hashedTemplate}`)}.xml`

        const existingVersion = await prisma.templateVersion.findFirst({
            where: { templateId: id, version: hashedTemplate },
            orderBy: { createdAt: "desc" },
        })

        let nextFilePath = existingVersion?.filePath
        if (!nextFilePath) {
            nextFilePath = await storageService.uploadFile(
                Buffer.from(updatedXmlContent, "utf8"),
                fileKey,
            )
        }

        const updatedTemplate = await prisma.templates.update({
            where: { id },
            data: {
                title,
                filePath: nextFilePath,
                requiredFields: variables,
                versions: existingVersion
                    ? undefined
                    : {
                        create: {
                            filePath: nextFilePath,
                            version: hashedTemplate,
                        },
                    },
            },
        })

        return NextResponse.json(updatedTemplate)
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "Failed to update template" },
            { status: 500 }
        )
    }
}