import prisma from "@/lib/prisma-main"
import { getAllBusinessIds } from "./business"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { Prisma, SCHEDULE_STATUS, FILE_STATUS, CampaignFile, APPROVAL_STATUS } from "@/app/generated/business/prisma"
import { getStorageService } from "./upload/modules"
import { transformXmlToTemplate } from "./template/xml-pdf-transformer"
import { generate } from "@pdfme/generator"
import { getInputFromTemplate } from "@pdfme/common"
import type { Schema, Template as PdfTemplate } from "@pdfme/common"
import type { TextWithVariablesSchema } from "@/lib/template/plugins/textWithVariables"
import { plugins } from "@/components/Editor/plugins"
import { getPdfmeServerFont } from "@/lib/pdfme/server-fonts"
import JSZip from "jszip"
import { refreshTemplateDependencies } from "@/utils/template/refreshTemplateDependencies"

const MAX_PARALLEL_BUSINESSES = 10
const MAX_PARALLEL_CAMPAIGNS_PER_BUSINESS = 3
const MAX_PARALLEL_CUSTOMER_PDFS = 8
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

type CampaignRunLogPayload = {
    campaignId: string
    campaignName: string
    triggerSource: CampaignRunTrigger
    status: SCHEDULE_STATUS
    success: boolean
    errorMessage?: string
    fileId?: string
    fileStatus: FILE_STATUS
    generatedDocuments: number
    startedAt: Date
    finishedAt: Date
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

type CampaignExecutionChunk = {
    jobId?: string
    chunkOrder?: number
    totalChunks?: number
    offset: number
    limit: number
    isFinalChunk?: boolean
}

type ContactListField = {
    field: string
    type?: string
}

type PdfArtifact = {
    fileName: string
    buffer: Buffer
}

const runWithConcurrency = async <T, R>(
    items: T[],
    maxParallel: number,
    worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
    if (items.length === 0) return []

    const parallel = Math.max(1, Math.min(maxParallel, items.length))
    const results = new Array<R>(items.length)
    let nextIndex = 0

    const workers = Array.from({ length: parallel }, async () => {
        while (true) {
            const currentIndex = nextIndex
            nextIndex += 1

            if (currentIndex >= items.length) break

            results[currentIndex] = await worker(items[currentIndex], currentIndex)
        }
    })

    await Promise.all(workers)
    return results
}

const normalizeFieldName = (value: string) => value.trim().toLowerCase()

const getLogPrefix = (source: CampaignRunTrigger) => {
    if (source === "MANUAL") return "[MANUAL]"
    if (source === "CRON") return "[CRON]"
    return "[SYSTEM]"
}

const createCampaignRunLog = async (
    businessPrisma: BusinessPrismaClient,
    payload: CampaignRunLogPayload,
) => {
    const durationMs = Math.max(
        0,
        payload.finishedAt.getTime() - payload.startedAt.getTime(),
    )

    await (businessPrisma as any).campaignRunLog.create({
        data: {
            campaignId: payload.campaignId,
            campaignName: payload.campaignName,
            triggerSource: payload.triggerSource,
            status: payload.status,
            success: payload.success,
            errorMessage: payload.errorMessage,
            fileId: payload.fileId,
            fileStatus: payload.fileStatus,
            generatedDocuments: payload.generatedDocuments,
            startedAt: payload.startedAt,
            finishedAt: payload.finishedAt,
            durationMs,
        },
    })
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

const extractRequiredFieldName = (value: unknown): string | null => {
    if (typeof value === "string") return value
    if (isPlainObject(value)) {
        if (typeof value.field === "string") return value.field
        if (typeof value.name === "string") return value.name
    }
    return null
}

const getRequiredFieldNames = (values: unknown): string[] => {
    if (!Array.isArray(values)) return []

    return values
        .map(extractRequiredFieldName)
        .filter((field): field is string => Boolean(field))
        .map((field) => normalizeFieldName(field))
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
    const variables = Array.isArray(schema.variables)
        ? schema.variables
        : typeof schema.variables === "string"
            ? [schema.variables]
            : []

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

    const buildComponentBlockInput = (schema: NamedSchema): Record<string, unknown> => {
        const nested = (schema as { componentSchemas?: NamedSchema[] }).componentSchemas
        if (!Array.isArray(nested)) return {}

        const result: Record<string, unknown> = {}
        for (const child of nested) {
            if (!child || typeof child !== "object") continue
            const childName = typeof child.name === "string" ? child.name : ""
            if (!childName) continue

            if (child.type === "ComponentBlocks") {
                result[childName] = buildComponentBlockInput(child)
                continue
            }

            if (child.type === "TextWithVariables") {
                result[childName] = buildVariablePayload(
                    child as TextWithVariablesSchema,
                    customerData,
                    normalizedCustomerValues,
                    contactFieldMap,
                )
                continue
            }

            result[childName] = getSchemaContent(child)
        }

        return result
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

            if (schema.type === "ComponentBlocks") {
                filledPage[key] = buildComponentBlockInput(schema)
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
            template: {
                include: {
                    approvers: true,
                },
            },
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

const toBaseFileName = (value: string) => {
    const normalized = value.trim()
    if (!normalized) return normalized
    const segments = normalized.split("/")
    return segments[segments.length - 1] || normalized
}

const isChunkExecution = (
    chunk?: CampaignExecutionChunk,
): chunk is Required<Pick<CampaignExecutionChunk, "jobId" | "chunkOrder" | "totalChunks" | "offset" | "limit">> & CampaignExecutionChunk => {
    return Boolean(
        chunk &&
            typeof chunk.jobId === "string" &&
            chunk.jobId &&
            typeof chunk.chunkOrder === "number" &&
            typeof chunk.totalChunks === "number",
    )
}

const finalizeChunkedCampaignFile = async (
    businessId: string,
    campaign: CampaignWithTemplates,
    businessPrisma: BusinessPrismaClient,
    storageService: NonNullable<ReturnType<typeof getStorageService>>,
    chunk: Required<Pick<CampaignExecutionChunk, "jobId" | "chunkOrder" | "totalChunks" | "offset" | "limit">>,
): Promise<CampaignFileResult | null> => {
    const chunkFiles = await (businessPrisma as any).campaignChunkFile.findMany({
        where: {
            campaignId: campaign.id,
            jobId: chunk.jobId,
            isDeleted: false,
        },
        orderBy: {
            chunkOrder: "asc",
        },
    })

    if (!Array.isArray(chunkFiles) || chunkFiles.length < chunk.totalChunks) {
        return null
    }

    const existingFinalFile = await businessPrisma.campaignFile.findFirst({
        where: {
            campaignId: campaign.id,
            isDeleted: false,
            fileName: {
                contains: `job-${chunk.jobId}`,
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    })

    if (existingFinalFile) {
        return {
            file: existingFinalFile,
            pdfCount: existingFinalFile.generatedDocuments,
        }
    }

    const finalZip = new JSZip()
    let totalPdfCount = 0

    for (const chunkFile of chunkFiles) {
        const chunkZipBuffer = await storageService.getFileBuffer(chunkFile.filePath)
        const parsedChunkZip = await JSZip.loadAsync(chunkZipBuffer)

        const entries = Object.values(parsedChunkZip.files)
        for (const entry of entries) {
            if (entry.dir) continue

            const entryBuffer = await entry.async("nodebuffer")
            const existing = finalZip.file(entry.name)
            const outputName = existing ? `chunk-${chunkFile.chunkOrder}-${entry.name}` : entry.name
            finalZip.file(outputName, entryBuffer)
        }

        totalPdfCount += Number(chunkFile.generatedDocuments ?? 0)
    }

    const finalZipBuffer = await finalZip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
    })

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const finalZipFileName = `${businessId}/campaign/campaign-${campaign.name}-job-${chunk.jobId}-${timestamp}.zip`
    const finalZipUrl = await storageService.uploadFile(finalZipBuffer, finalZipFileName, {
        contentType: "application/zip",
    })

    const generationFinishedAt = new Date()
    const expiresAt = new Date(Date.now() + ZIP_EXPIRATION_MS)

    const campaignFile = await businessPrisma.campaignFile.create({
        data: {
            campaignId: campaign.id,
            fileName: toBaseFileName(finalZipFileName),
            filePath: finalZipUrl,
            generatedDocuments: totalPdfCount,
            status: FILE_STATUS.AVALIABLE,
            generationStartedAt: new Date(),
            generationFinishedAt,
            expiresAt,
        } as any,
    })

    for (const chunkFile of chunkFiles) {
        try {
            await storageService.deleteFile(chunkFile.filePath)
        } catch (error) {
            console.warn(
                `Failed to delete chunk file ${chunkFile.filePath} for campaign ${campaign.id} and job ${chunk.jobId}:`,
                error,
            )
        }
    }

    await (businessPrisma as any).campaignChunkFile.updateMany({
        where: {
            campaignId: campaign.id,
            jobId: chunk.jobId,
            isDeleted: false,
        },
        data: {
            isDeleted: true,
            deletedAt: new Date(),
        },
    })

    return {
        file: campaignFile,
        pdfCount: totalPdfCount,
    }
}

const createCampaignFile = async (
    businessId: string,
    campaign: CampaignWithTemplates,
    businessPrisma: BusinessPrismaClient,
    chunk?: CampaignExecutionChunk,
): Promise<CampaignFileResult | null> => {
    const generationStartedAt = new Date()

    const contactList = campaign.contactlist
    if (!contactList) {
        throw new Error("Campaign is missing a contact list")
    }

    const allCustomers = Array.isArray(contactList.customers) ? contactList.customers : []
    const customers = chunk
        ? allCustomers.slice(
              Math.max(0, chunk.offset),
              Math.max(0, chunk.offset) + Math.max(0, chunk.limit),
          )
        : allCustomers
    if (customers.length === 0) return null

    const contactFields = toContactFields(contactList.fields)
    const contactFieldMap = buildContactFieldMap(contactFields)

    const sourceTemplates = campaign.templates
        .map((ct) => ct.template)
        .filter((template): template is NonNullable<typeof template> => Boolean(template?.id))

    const templates = (
        await Promise.all(
            sourceTemplates.map(async (template) => {
                console.log(`Refreshing dependencies for template ${template.id} (${template.title})`)
                const refreshedTemplate = await refreshTemplateDependencies({
                    prisma: businessPrisma,
                    templateId: template.id,
                    businessId,
                })

                return {
                    ...template,
                    filePath: refreshedTemplate?.filePath ?? template.filePath,
                    requiredFields: refreshedTemplate?.requiredFields ?? template.requiredFields,
                }
            }),
        )
    ).filter((template) => Boolean(template.filePath))

    if (templates.length === 0) return null

    const availableContactFields = new Set(
        contactFields.map((field) => normalizeFieldName(field.field)),
    )

    for (const template of templates) {
        const requiredFields = getRequiredFieldNames(template.requiredFields)
        const missingFields = requiredFields.filter((field) => !availableContactFields.has(field))

        if (missingFields.length) {
            const templateLabel = template.title || template.id
            throw new Error(
                `Customer list is missing required fields referenced by template \"${templateLabel}\": ${missingFields.join(", ")}`,
            )
        }
    }

    const hasPendingApprovals = templates.some((template) => {
        const approvers = template.approvers ?? []
        if (approvers.length === 0) return false

        const approvalsRejected = approvers.some((approver) => approver.status === APPROVAL_STATUS.REJECTED)
        const approvedCount = approvers.filter((approver) => approver.status === APPROVAL_STATUS.APPROVED).length
        const approvalsComplete = approvedCount === approvers.length && !approvalsRejected

        return !approvalsComplete
    })

    if (hasPendingApprovals) {
        throw new Error("Campaign file is not yet fully approved")
    }

    const storageService = getStorageService()
    if (!storageService) {
        throw new Error("Storage service not configured")
    }

    const resolveComponentSchemas = (() => {
        const cache = new Map<string, Schema[] | null>()

        return async (componentName: string) => {
            const normalized = componentName.trim()
            if (!normalized) return null
            if (cache.has(normalized)) return cache.get(normalized) ?? null

            const componentBlock = await businessPrisma.componentBlock.findUnique({
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

    const pdfArtifacts: PdfArtifact[] = []
    const font = await getPdfmeServerFont()
    let generatedPdfProgress = 0

    for (const template of templates) {
        const fileContent = await storageService.getFileContent(template.filePath!)
        const parsedContent = await transformXmlToTemplate(fileContent, { resolveComponentSchemas })

        const generatedArtifacts = await runWithConcurrency(
            customers,
            MAX_PARALLEL_CUSTOMER_PDFS,
            async (customer) => {
            const customerData = toCustomerRecord(customer.data)
            const inputs = buildInputsForCustomer(parsedContent, customerData, contactFieldMap)
            const pdfBytes = await generate({
                template: parsedContent,
                inputs,
                plugins,
                options: {
                    font,
                },
            })

            const fileName = `campaign-${campaign.name}-customer-${customer.id ?? "unknown"}.pdf`
                generatedPdfProgress += 1
                console.info(generatedPdfProgress)
                return { fileName, buffer: Buffer.from(pdfBytes) }
            },
        )

        pdfArtifacts.push(...generatedArtifacts)
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

    if (isChunkExecution(chunk)) {
        const chunkZipFileName = `${businessId}/campaign/chunks/${campaign.id}/${chunk.jobId}/chunk-${chunk.chunkOrder}.zip`
        const chunkZipUrl = await storageService.uploadFile(zipBuffer, chunkZipFileName, {
            contentType: "application/zip",
        })

        await (businessPrisma as any).campaignChunkFile.upsert({
            where: {
                campaignId_jobId_chunkOrder: {
                    campaignId: campaign.id,
                    jobId: chunk.jobId,
                    chunkOrder: chunk.chunkOrder,
                },
            },
            create: {
                campaignId: campaign.id,
                jobId: chunk.jobId,
                chunkOrder: chunk.chunkOrder,
                totalChunks: chunk.totalChunks,
                fileName: chunkZipFileName,
                filePath: chunkZipUrl,
                generatedDocuments: pdfArtifacts.length,
                isDeleted: false,
            },
            update: {
                totalChunks: chunk.totalChunks,
                fileName: chunkZipFileName,
                filePath: chunkZipUrl,
                generatedDocuments: pdfArtifacts.length,
                isDeleted: false,
                deletedAt: null,
            },
        })

        return finalizeChunkedCampaignFile(
            businessId,
            campaign,
            businessPrisma,
            storageService,
            chunk,
        )
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const zipFileName = `${businessId}/campaign/campaign-${campaign.name}-${timestamp}.zip`
    const zipUrl = await storageService.uploadFile(zipBuffer, zipFileName, {
        contentType: "application/zip",
    })
    const generationFinishedAt = new Date()

    const expiresAt = new Date(Date.now() + ZIP_EXPIRATION_MS)

    const campaignFileData = {
        campaignId: campaign.id,
        fileName: toBaseFileName(zipFileName),
        filePath: zipUrl,
        generatedDocuments: pdfArtifacts.length,
        status: FILE_STATUS.AVALIABLE,
        generationStartedAt,
        generationFinishedAt,
        expiresAt,
    } as any

    const campaignFile = await businessPrisma.campaignFile.create({
        data: campaignFileData,
    })

    return { file: campaignFile, pdfCount: pdfArtifacts.length }
}

const runCampaignForBusiness = async (
    campaignId: string,
    businessId: string,
    triggerSource: CampaignRunTrigger,
    chunk?: CampaignExecutionChunk,
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
        const logPrefix = getLogPrefix(triggerSource)
        
        console.log(
            `[Campaign Runner][${triggerSource}] Running ${campaignsToRun.length} campaign(s) for business ${business.name} (${business.id})`,
        )
        const campaignOutcomes = await runWithConcurrency(
            campaignsToRun,
            MAX_PARALLEL_CAMPAIGNS_PER_BUSINESS,
            async (campaign) => {
                const runStartedAt = new Date()
                const isChunkRun = isChunkExecution(chunk)

                await businessPrisma.campaign.update({
                    where: { id: campaign.id },
                    data: {
                        scheduleStatus: SCHEDULE_STATUS.RUNNING,
                        fileStatus: isChunkRun ? FILE_STATUS.PENDING : FILE_STATUS.PENDING,
                        logs: {
                            create: {
                                message: `${logPrefix} Campaign run started`,
                                status: SCHEDULE_STATUS.RUNNING,
                            },
                        },
                    },
                })

                try {
                    const campaignFileResult = await createCampaignFile(businessId, campaign, businessPrisma, chunk)
                    const hasGeneratedFile = Boolean(campaignFileResult?.file?.id)
                    const nextFileStatus = isChunkRun
                        ? hasGeneratedFile
                            ? FILE_STATUS.AVALIABLE
                            : FILE_STATUS.PENDING
                        : hasGeneratedFile
                            ? FILE_STATUS.AVALIABLE
                            : FILE_STATUS.EMPTY
                    const nextScheduleStatus = isChunkRun
                        ? hasGeneratedFile && Boolean(chunk?.isFinalChunk)
                            ? SCHEDULE_STATUS.TRIGGERED
                            : SCHEDULE_STATUS.RUNNING
                        : SCHEDULE_STATUS.TRIGGERED
                    const runFinishedAt = new Date()
                    const chunkSuffix = chunk
                        ? ` (chunk offset=${chunk.offset}, limit=${chunk.limit}${chunk.isFinalChunk ? ", final" : ""})`
                        : ""
                    const successMessage = hasGeneratedFile
                        ? `${logPrefix} Campaign run successfully${chunkSuffix}`
                        : isChunkRun
                            ? `${logPrefix} Campaign chunk uploaded${chunkSuffix}`
                            : `${logPrefix} Campaign run completed without generated files${chunkSuffix}`

                    if (campaignFileResult) {
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

                    await createCampaignRunLog(businessPrisma, {
                        campaignId: campaign.id,
                        campaignName: campaign.name,
                        triggerSource,
                        status: nextScheduleStatus,
                        success: true,
                        fileId: campaignFileResult?.file.id,
                        fileStatus: nextFileStatus,
                        generatedDocuments: campaignFileResult?.pdfCount ?? 0,
                        startedAt: runStartedAt,
                        finishedAt: runFinishedAt,
                    })

                    return {
                        fileInfo: campaignFileResult,
                        result: {
                            campaignId: campaign.id,
                            success: true,
                            fileId: campaignFileResult?.file.id,
                            fileStatus: nextFileStatus,
                            scheduleStatus: nextScheduleStatus,
                            pdfCount: campaignFileResult?.pdfCount,
                        } satisfies CampaignRunResult,
                    }
                } catch (campaignError) {
                    const errorMessage = campaignError instanceof Error ? campaignError.message : "Unknown error"
                    const nextFileStatus = FILE_STATUS.FAILED
                    const nextScheduleStatus = SCHEDULE_STATUS.FAILED
                    const runFinishedAt = new Date()

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

                    await createCampaignRunLog(businessPrisma, {
                        campaignId: campaign.id,
                        campaignName: campaign.name,
                        triggerSource,
                        status: nextScheduleStatus,
                        success: false,
                        errorMessage,
                        fileStatus: nextFileStatus,
                        generatedDocuments: 0,
                        startedAt: runStartedAt,
                        finishedAt: runFinishedAt,
                    })

                    return {
                        fileInfo: null,
                        result: {
                            campaignId: campaign.id,
                            success: false,
                            error: errorMessage,
                            fileStatus: nextFileStatus,
                            scheduleStatus: nextScheduleStatus,
                        } satisfies CampaignRunResult,
                    }
                }
            },
        )

        const campaignResults = campaignOutcomes.map((outcome) => outcome.result)
        const lastSuccessfulWithFile = [...campaignOutcomes]
            .reverse()
            .find((outcome) => Boolean(outcome.fileInfo))
        lastFileInfo = lastSuccessfulWithFile?.fileInfo ?? null

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
    chunk?: CampaignExecutionChunk
}

export const runCampaignJob = async ({
    campaignId = "",
    businessIds = [],
    maxParallel = MAX_PARALLEL_BUSINESSES,
    triggerSource = "SYSTEM",
    chunk,
}: RunCampaignJobOptions) => {
    const businessIdsToRun = businessIds.length > 0 ? businessIds : await getAllBusinessIds()
    if (businessIdsToRun.length === 0) return []

    const parallelLimit = Math.max(1, maxParallel)

    return runWithConcurrency(
        businessIdsToRun,
        parallelLimit,
        async (businessId) => runCampaignForBusiness(campaignId, businessId, triggerSource, chunk),
    )
}