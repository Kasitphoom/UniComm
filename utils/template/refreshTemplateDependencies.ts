import { Schema } from "@pdfme/common"
import { hashTemplate } from "@/lib/draftStore"
import { getStorageService } from "@/utils/upload/modules"
import { transformTemplateToXml, transformXmlToTemplate } from "@/utils/template/xml-pdf-transformer"

type RefreshTemplateDependenciesArgs = {
    prisma: any
    templateId: string
    businessId: string
}

export const refreshTemplateDependencies = async ({
    prisma,
    templateId,
    businessId,
}: RefreshTemplateDependenciesArgs) => {
    const storageService = getStorageService()
    if (!storageService) {
        throw new Error("Storage service not configured")
    }

    const existingTemplate = await prisma.templates.findUnique({
        where: { id: templateId },
        select: {
            id: true,
            title: true,
            filePath: true,
            requiredFields: true,
        },
    })

    if (!existingTemplate) return null
    if (!existingTemplate.filePath) {
        throw new Error("Template file path is missing")
    }

    const resolveComponentSchemas = (() => {
        const cache = new Map<string, Schema[] | null>()

        return async (componentName: string) => {
            const normalized = componentName.trim()
            if (!normalized) return null
            if (cache.has(normalized)) return cache.get(normalized) ?? null

            const componentBlock = await prisma.componentBlock.findUnique({
                where: { name: normalized },
                select: { filePath: true },
            })

            if (!componentBlock?.filePath) {
                cache.set(normalized, null)
                return null
            }

            const xmlContent = await storageService.getFileContent(componentBlock.filePath)
            const parsed = await transformXmlToTemplate(xmlContent, {
                resolveComponentSchemas: async (nestedName: string) => {
                    const nestedNormalized = nestedName.trim()
                    if (!nestedNormalized) return null
                    if (cache.has(nestedNormalized)) return cache.get(nestedNormalized) ?? null

                    const nestedBlock = await prisma.componentBlock.findUnique({
                        where: { name: nestedNormalized },
                        select: { filePath: true },
                    })
                    if (!nestedBlock?.filePath) {
                        cache.set(nestedNormalized, null)
                        return null
                    }

                    const nestedXml = await storageService.getFileContent(nestedBlock.filePath)
                    const nestedParsed = await transformXmlToTemplate(nestedXml)
                    const nestedPage = nestedParsed.schemas?.[0]
                    const nestedResult = Array.isArray(nestedPage) ? nestedPage : null
                    cache.set(nestedNormalized, nestedResult)
                    return nestedResult
                },
            })

            const firstPage = parsed.schemas?.[0]
            const result = Array.isArray(firstPage) ? firstPage : null
            cache.set(normalized, result)
            return result
        }
    })()

    const currentXml = await storageService.getFileContent(existingTemplate.filePath)
    const parsedTemplate = await transformXmlToTemplate(currentXml, {
        resolveComponentSchemas,
    })
    const hashedTemplate = await hashTemplate(parsedTemplate)
    const { xml: refreshedXml, variables } = await transformTemplateToXml(parsedTemplate, {
        resolveComponentSchemas,
    })

    const existingVersion = await prisma.templateVersion.findFirst({
        where: { templateId: existingTemplate.id, version: hashedTemplate },
        orderBy: { createdAt: "desc" },
    })

    let filePath = existingVersion?.filePath
    if (!filePath) {
        const fileKey = `${businessId}/templates/${encodeURIComponent(`${existingTemplate.id}.${hashedTemplate}`)}.xml`
        filePath = await storageService.uploadFile(Buffer.from(refreshedXml, "utf8"), fileKey)
    }

    const updatedTemplate = await prisma.templates.update({
        where: { id: existingTemplate.id },
        data: {
            filePath,
            requiredFields: variables,
            versions: existingVersion
                ? undefined
                : {
                      create: {
                          filePath,
                          version: hashedTemplate,
                      },
                  },
        },
        select: {
            id: true,
            title: true,
            filePath: true,
            requiredFields: true,
        },
    })

    return updatedTemplate
}
