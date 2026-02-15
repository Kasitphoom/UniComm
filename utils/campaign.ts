import prisma from "@/lib/prisma-main"
import { getAllBusinessIds } from "./business"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { Prisma, SCHEDULE_STATUS, FILE_STATUS, CampaignFile } from "@/app/generated/business/prisma"
import { getStorageService } from "./upload/modules"
import { transformXmlToTemplate } from "./template/xml-pdf-transformer"
import { generate } from "@pdfme/generator"
import { getInputFromTemplate } from "@pdfme/common"
import type { Template as PdfTemplate } from "@pdfme/common"
import type { TextWithVariablesSchema } from "@/lib/template/plugins/textWithVariables"
import { plugins } from "@/components/Editor/plugins"
import JSZip from "jszip"

const MAX_PARALLEL_BUSINESSES = 10
const ZIP_EXPIRATION_MS = 14 * 24 * 60 * 60 * 1000 // 2 weeks
type BusinessPrismaClient = ReturnType<typeof getBusinessPrisma>

type CampaignRunResult = {
    campaignId: string
    success: boolean
    error?: string
    fileId?: string
    fileStatus: FILE_STATUS
    scheduleStatus: SCHEDULE_STATUS
    pdfCount?: number
}

type CampaignRunTrigger = "MANUAL" | "CRON" | "SYSTEM"

type CampaignJobResult = {
    businessId: string
    success: boolean
    error?: string
    lastFileId?: string
    lastFilePath?: string
    pdfCount?: number
    campaigns: CampaignRunResult[]
}

type ContactListField = {
    field: string
    type?: string
}

type PdfArtifact = {
    fileName: string
    buffer: Buffer
}

const normalizeFieldName = (value: string) => value.trim().toLowerCase()

const getLogPrefix = (source: CampaignRunTrigger) => {
    if (source === "MANUAL") return "[MANUAL]"
    if (source === "CRON") return "[CRON]"
    return "[SYSTEM]"
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const toContactFields = (fields: unknown): ContactListField[] => {
    if (!Array.isArray(fields)) return []

    return fields
        .map((entry) => {
            if (typeof entry === "string") {
                const trimmed = entry.trim()
                return trimmed ? { field: trimmed } : null
            }

            if (!isPlainObject(entry)) return null

            const fieldName =
                typeof entry.field === "string"
                    ? entry.field
                    : typeof entry.name === "string"
                        ? entry.name
                        : undefined

            if (!fieldName) return null

            return {
                field: fieldName,
                type: typeof entry.type === "string" ? entry.type : undefined,
            }
        })
        .filter((entry): entry is ContactListField => Boolean(entry?.field))
}

const buildContactFieldMap = (fields: ContactListField[]) => {
    const map = new Map<string, string>()
    fields.forEach(({ field }) => {
        map.set(normalizeFieldName(field), field)
    })
    return map
}

const stringifyValue = (value: unknown): string => {
    if (value === null || value === undefined) return ""
    if (typeof value === "string") return value
    if (typeof value === "number" || typeof value === "boolean") return String(value)
    try {
        return JSON.stringify(value)
    } catch {
        return ""
    }
}

const buildNormalizedValueMap = (data: Record<string, unknown>) => {
    const map = new Map<string, string>()
    Object.entries(data).forEach(([key, value]) => {
        map.set(normalizeFieldName(key), stringifyValue(value))
    })
    return map
}

const toCustomerRecord = (value: unknown): Record<string, unknown> => {
    if (isPlainObject(value)) return value
    return {}
}

const buildVariablePayload = (
    schema: TextWithVariablesSchema,
    dataRecord: Record<string, unknown>,
    normalizedCustomerValues: Map<string, string>,
    contactFieldMap: Map<string, string>,
) => {
    const payload: Record<string, string> = {}
    const variables = Array.isArray(schema.variables) ? schema.variables : []

    for (const variable of variables) {
        if (!variable) continue
        const normalized = normalizeFieldName(variable)
        const candidateKey = contactFieldMap.get(normalized) ?? variable
        const directValue = dataRecord[candidateKey]

        if (directValue !== undefined) {
            payload[variable] = stringifyValue(directValue)
            continue
        }

        payload[variable] = normalizedCustomerValues.get(normalized) ?? ""
    }

    return payload
}

const buildInputsForCustomer = (
    template: PdfTemplate,
    customerData: Record<string, unknown>,
    contactFieldMap: Map<string, string>,
) => {
    const normalizedCustomerValues = buildNormalizedValueMap(customerData)
    const inputsShape = getInputFromTemplate(template)

    type NamedSchema = Record<string, unknown> & { name?: string; type?: string }

    const getSchemaContent = (schema: NamedSchema): string => {
        const rawContent = (schema as { content?: unknown }).content
        if (rawContent === null || rawContent === undefined) return ""
        if (typeof rawContent === "string") return rawContent
        if (typeof rawContent === "number" || typeof rawContent === "boolean") return String(rawContent)
        try {
            return JSON.stringify(rawContent)
        } catch {
            return ""
        }
    }

    return inputsShape.map((pageInput, pageIndex) => {
        const pageSchemas = template.schemas[pageIndex] || []
        const schemaByName = new Map<string, NamedSchema>()

        pageSchemas.forEach((schema) => {
            const namedSchema = schema as NamedSchema
            if (typeof namedSchema.name === "string") {
                schemaByName.set(namedSchema.name, namedSchema)
            }
        })

        const filledPage: Record<string, unknown> = { ...pageInput }

        Object.keys(pageInput).forEach((key) => {
            const schema = schemaByName.get(key)
            if (!schema) return

            if (schema.type === "TextWithVariables") {
                filledPage[key] = buildVariablePayload(
                    schema as TextWithVariablesSchema,
                    customerData,
                    normalizedCustomerValues,
                    contactFieldMap,
                )
                return
            }

            if (filledPage[key] === undefined || filledPage[key] === null) {
                filledPage[key] = getSchemaContent(schema)
            }
        })

        return filledPage
    })
}

const campaignIncludes = {
    templates: {
        include: {
            template: true,
        }
    },
    contactlist: {
        include: {
            customers: true,
        }
    },
} satisfies Prisma.CampaignInclude

export type CampaignWithTemplates = Prisma.CampaignGetPayload<{ include: typeof campaignIncludes }>

type CampaignFileResult = {
    file: CampaignFile
    pdfCount: number
}

const createCampaignFile = async (
    campaign: CampaignWithTemplates,
    businessPrisma: BusinessPrismaClient,
): Promise<CampaignFileResult | null> => {
    const contactList = campaign.contactlist
    if (!contactList) {
        throw new Error("Campaign is missing a contact list")
    }

    const customers = Array.isArray(contactList.customers) ? contactList.customers : []
    if (customers.length === 0) return null

    const contactFields = toContactFields(contactList.fields)
    const contactFieldMap = buildContactFieldMap(contactFields)

    const templates = campaign.templates
        .map((ct) => ct.template)
        .filter((template): template is NonNullable<typeof template> => Boolean(template?.filePath))

    if (templates.length === 0) return null

    const storageService = getStorageService()
    if (!storageService) {
        throw new Error("Storage service not configured")
    }

    const pdfArtifacts: PdfArtifact[] = []

    for (const template of templates) {
        const fileContent = await storageService.getFileContent(template.filePath!)
        const parsedContent = await transformXmlToTemplate(fileContent)

        for (const customer of customers) {
            const customerData = toCustomerRecord(customer.data)
            const inputs = buildInputsForCustomer(parsedContent, customerData, contactFieldMap)
            const pdfBytes = await generate({
                template: parsedContent,
                inputs,
                plugins,
            })

            const fileName = `campaign-${campaign.name}-customer-${customer.id ?? "unknown"}.pdf`
            pdfArtifacts.push({ fileName, buffer: Buffer.from(pdfBytes) })
        }
    }

    if (pdfArtifacts.length === 0) return null

    const zip = new JSZip()
    pdfArtifacts.forEach(({ fileName, buffer }) => {
        zip.file(fileName, buffer)
    })

    const zipBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
    })

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const zipFileName = `campaign-${campaign.name}-${timestamp}.zip`
    const zipUrl = await storageService.uploadFile(zipBuffer, zipFileName, {
        contentType: "application/zip",
    })

    const expiresAt = new Date(Date.now() + ZIP_EXPIRATION_MS)

    const campaignFile = await businessPrisma.campaignFile.create({
        data: {
            campaignId: campaign.id,
            fileName: zipFileName,
            filePath: zipUrl,
            status: FILE_STATUS.AVALIABLE,
            expiresAt,
        },
    })

    return { file: campaignFile, pdfCount: pdfArtifacts.length }
}

const runCampaignForBusiness = async (
    campaignId: string,
    businessId: string,
    triggerSource: CampaignRunTrigger,
): Promise<CampaignJobResult> => {
    try {
        const business = await prisma.business.findUnique({
            where: { id: businessId },
            select: { id: true, name: true },
        })

        if (!business) {
            return { businessId, success: false, error: "Business not found", campaigns: [] }
        }

        const businessPrisma = getBusinessPrisma(businessId)

        // time round down to nearest minute
        const startTime = new Date()
        startTime.setSeconds(0, 0)
        const endTime = new Date(startTime.getTime())
        endTime.setSeconds(endTime.getSeconds() + 59, 999)
        
        const campaigns = campaignId.trim() === "" ? 
            await businessPrisma.campaign.findMany({ 
                where: { 
                    scheduleStatus: SCHEDULE_STATUS.PENDING,
                    scheduledAt: {
                        gte: startTime,
                        lte: endTime,
                    }
                },
                include: campaignIncludes,
            }) :
            await businessPrisma.campaign.findUnique({
                where: { id: campaignId },
                include: campaignIncludes,
            })
        
        if (!campaigns || (Array.isArray(campaigns) && campaigns.length === 0)) {
            console.info(
                `[Campaign Runner][${triggerSource}] No campaigns to run for business ${business.name} (${business.id})`,
            )
            return { businessId, success: false, error: "No campaigns to run", campaigns: [] }
        }

        const campaignsToRun = Array.isArray(campaigns) ? campaigns : [campaigns]
        let lastFileInfo: CampaignFileResult | null = null
        const campaignResults: CampaignRunResult[] = []
        const logPrefix = getLogPrefix(triggerSource)
        
        console.log(
            `[Campaign Runner][${triggerSource}] Running ${campaignsToRun.length} campaign(s) for business ${business.name} (${business.id})`,
        )
        for (const campaign of campaignsToRun) {
            try {
                const campaignFileResult = await createCampaignFile(campaign, businessPrisma)
                const hasGeneratedFile = Boolean(campaignFileResult?.file?.id)
                const nextFileStatus = hasGeneratedFile ? FILE_STATUS.AVALIABLE : FILE_STATUS.EMPTY
                const nextScheduleStatus = SCHEDULE_STATUS.TRIGGERED
                const successMessage = hasGeneratedFile
                    ? `${logPrefix} Campaign run successfully`
                    : `${logPrefix} Campaign run completed without generated files`

                if (campaignFileResult) {
                    lastFileInfo = campaignFileResult
                    console.info(
                        `[Campaign ${campaign.name}] Uploaded campaign ZIP (${campaignFileResult.pdfCount} PDFs) to ${campaignFileResult.file.filePath}`,
                    )
                } else {
                    console.info(`[Campaign ${campaign.name}] No PDFs generated (missing data)`)
                }

                await businessPrisma.campaign.update({
                    where: { id: campaign.id },
                    data: {
                        fileStatus: nextFileStatus,
                        scheduleStatus: nextScheduleStatus,
                        executedAt: new Date(),
                        logs: {
                            create: {
                                message: successMessage,
                                status: nextScheduleStatus,
                            },
                        },
                    },
                })

                campaignResults.push({
                    campaignId: campaign.id,
                    success: true,
                    fileId: campaignFileResult?.file.id,
                    fileStatus: nextFileStatus,
                    scheduleStatus: nextScheduleStatus,
                    pdfCount: campaignFileResult?.pdfCount,
                })
            } catch (campaignError) {
                const errorMessage = campaignError instanceof Error ? campaignError.message : "Unknown error"
                const nextFileStatus = FILE_STATUS.FAILED
                const nextScheduleStatus = SCHEDULE_STATUS.FAILED

                console.error(`[Campaign ${campaign.name}] Failed to run: ${errorMessage}`)

                await businessPrisma.campaign.update({
                    where: { id: campaign.id },
                    data: {
                        fileStatus: nextFileStatus,
                        scheduleStatus: nextScheduleStatus,
                        executedAt: new Date(),
                        logs: {
                            create: {
                                message: `${logPrefix} Campaign run failed: ${errorMessage}`,
                                status: nextScheduleStatus,
                            },
                        },
                    },
                })

                campaignResults.push({
                    campaignId: campaign.id,
                    success: false,
                    error: errorMessage,
                    fileStatus: nextFileStatus,
                    scheduleStatus: nextScheduleStatus,
                })
            }
        }

        const allSuccessful = campaignResults.every((result) => result.success)
        const aggregatedError = allSuccessful
            ? undefined
            : campaignResults.find((result) => !result.success)?.error ?? "One or more campaigns failed"

        const summaryMessage = allSuccessful
            ? `[Campaign Runner][${triggerSource}] Successfully processed ${campaignResults.length} campaign(s) for business ${business.name} (${business.id})`
            : `[Campaign Runner][${triggerSource}] Completed with failures for business ${business.name} (${business.id}). Successful: ${campaignResults.filter((result) => result.success).length}, Failed: ${campaignResults.filter((result) => !result.success).length}`
        console.info(summaryMessage)

        return {
            businessId,
            success: allSuccessful,
            error: aggregatedError,
            lastFileId: lastFileInfo?.file.id,
            lastFilePath: lastFileInfo?.file.filePath,
            pdfCount: lastFileInfo?.pdfCount,
            campaigns: campaignResults,
        }
    } catch (error) {
        return {
            businessId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            campaigns: [],
        }
    }
}

type RunCampaignJobOptions = {
    campaignId?: string
    businessIds?: string[]
    maxParallel?: number
    triggerSource?: CampaignRunTrigger
}

export const runCampaignJob = async ({
    campaignId = "",
    businessIds = [],
    maxParallel = MAX_PARALLEL_BUSINESSES,
    triggerSource = "SYSTEM",
}: RunCampaignJobOptions) => {
    const businessIdsToRun = businessIds.length > 0 ? businessIds : await getAllBusinessIds()
    if (businessIdsToRun.length === 0) return []

    const parallelLimit = Math.max(1, maxParallel)
    const results: CampaignJobResult[] = []

    for (let i = 0; i < businessIdsToRun.length; i += parallelLimit) {
        const batch = businessIdsToRun.slice(i, i + parallelLimit)
        const batchResults = await Promise.all(
            batch.map((businessId) => runCampaignForBusiness(campaignId, businessId, triggerSource)),
        )
        results.push(...batchResults)
    }

    return results
}