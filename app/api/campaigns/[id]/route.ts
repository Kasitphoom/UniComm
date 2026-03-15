import { NextRequest, NextResponse } from "next/server"
import { Prisma, UserRole } from "@/app/generated/business/prisma"
import { requireAuth } from "@/lib/api-auth"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { userHasPermissionAPI } from "@/utils/permissions"
import { getStorageService } from "@/utils/upload/modules"
import { refreshTemplateDependencies } from "@/utils/template/refreshTemplateDependencies"

const normalizeFieldName = (value: string) => value.trim().toLowerCase()

const extractFieldName = (value: unknown): string | null => {
    if (typeof value === "string") return value
    if (typeof value === "object" && value !== null) {
        const candidate = value as Record<string, unknown>
        if (typeof candidate.field === "string") return candidate.field
        if (typeof candidate.name === "string") return candidate.name
    }
    return null
}

const toFieldNameSet = (values: unknown): Set<string> => {
    if (!Array.isArray(values)) return new Set()
    return new Set(
        values
            .map(extractFieldName)
            .filter((field): field is string => Boolean(field))
            .map((field) => normalizeFieldName(field)),
    )
}

type PatchContext = {
    params: Promise<{ id: string }>
}

/**
 * @swagger
 * /api/campaigns/{id}:
 *   get:
 *     summary: Get campaign basic details
 *     tags:
 *       - Campaigns
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign fetched successfully
 *       400:
 *         description: Missing campaign ID or no active business selected
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Campaign not found
 *       500:
 *         description: Failed to fetch campaign
 */
export async function GET(req: NextRequest, { params }: PatchContext) {
    try {
        const auth = await requireAuth(req)
        if (!auth.ok) return auth.response
        if (!auth.businessId) {
            return NextResponse.json(
                { error: "No active business selected" },
                { status: 400 },
            )
        }

        const { id: campaignId } = await params
        if (!campaignId) {
            return NextResponse.json(
                { error: "Campaign ID is required" },
                { status: 400 },
            )
        }

        const prisma = await getBusinessPrisma(auth.businessId)
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            select: {
                id: true,
                name: true,
            },
        })

        if (!campaign) {
            return NextResponse.json(
                { error: "Campaign not found" },
                { status: 404 },
            )
        }

        return NextResponse.json(campaign)
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || "Failed to fetch campaign" },
            { status: 500 },
        )
    }
}

/**
 * @swagger
 * /api/campaigns/{id}:
 *   patch:
 *     summary: Update campaign details
 *     tags:
 *       - Campaigns
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *               templateIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               customerListId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Campaign updated successfully
 *       400:
 *         description: Invalid request payload or validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Campaign, customer list, or template not found
 *       409:
 *         description: Campaign name already exists
 *       500:
 *         description: Failed to update campaign
 */
export async function PATCH(req: NextRequest, { params }: PatchContext) {
    try {
        const auth = await requireAuth(req)
        if (!auth.ok) return auth.response
        if (!auth.businessId) {
            return NextResponse.json(
                { error: "No active business selected" },
                { status: 400 },
            )
        }

        const hasPermission = await userHasPermissionAPI(req, [
            UserRole.OWNER,
            UserRole.ADMIN,
            UserRole.MEMBER,
        ])
        if (!hasPermission) {
            return NextResponse.json(
                { error: "Insufficient permissions" },
                { status: 403 },
            )
        }

        const { id: campaignId } = await params
        if (!campaignId) {
            return NextResponse.json(
                { error: "Campaign ID is required" },
                { status: 400 },
            )
        }

        const body = await req.json().catch(() => null)
        if (!body || typeof body !== "object") {
            return NextResponse.json(
                { error: "Invalid request body" },
                { status: 400 },
            )
        }

        const { name, scheduledAt, templateIds, customerListId } = body as {
            name?: unknown
            scheduledAt?: unknown
            templateIds?: unknown
            customerListId?: unknown
        }

        const fieldsProvided = [name, scheduledAt, templateIds, customerListId].some((value) => value !== undefined)
        if (!fieldsProvided) {
            return NextResponse.json(
                { error: "No updatable fields were provided" },
                { status: 400 },
            )
        }

        const prisma = await getBusinessPrisma(auth.businessId)

        const existing = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
                templates: {
                    include: {
                        template: true,
                    },
                },
                contactlist: {
                    include: {
                        _count: {
                            select: {
                                customers: true,
                            },
                        },
                    },
                },
                logs: {
                    orderBy: { createdAt: "desc" },
                    take: 5,
                },
            },
        })

        if (!existing) {
            return NextResponse.json(
                { error: "Campaign not found" },
                { status: 404 },
            )
        }

        let trimmedName: string | undefined
        if (name !== undefined) {
            if (typeof name !== "string" || !name.trim()) {
                return NextResponse.json(
                    { error: "Campaign name must be a non-empty string" },
                    { status: 400 },
                )
            }
            trimmedName = name.trim()
            if (trimmedName !== existing.name) {
                const duplicate = await prisma.campaign.findUnique({
                    where: { name: trimmedName },
                    select: { id: true },
                })
                if (duplicate && duplicate.id !== campaignId) {
                    return NextResponse.json(
                        { error: "A campaign with this name already exists" },
                        { status: 409 },
                    )
                }
            }
        }

        let scheduledDate: Date | undefined
        if (scheduledAt !== undefined) {
            if (typeof scheduledAt !== "string" || !scheduledAt.trim()) {
                return NextResponse.json(
                    { error: "scheduledAt must be a valid ISO datetime string" },
                    { status: 400 },
                )
            }
            scheduledDate = new Date(scheduledAt)
            if (Number.isNaN(scheduledDate.getTime())) {
                return NextResponse.json(
                    { error: "scheduledAt must be a valid datetime" },
                    { status: 400 },
                )
            }
        }

        const templateIdsProvided = Object.prototype.hasOwnProperty.call(body, "templateIds")
        let templateIdList: string[] | undefined
        if (templateIdsProvided) {
            if (!Array.isArray(templateIds)) {
                return NextResponse.json(
                    { error: "templateIds must be an array of template IDs" },
                    { status: 400 },
                )
            }
            templateIdList = Array.from(
                new Set(
                    templateIds
                        .filter((id): id is string => typeof id === "string")
                        .map((id) => id.trim())
                        .filter(Boolean),
                ),
            )
            if (!templateIdList.length) {
                return NextResponse.json(
                    { error: "At least one template must be provided" },
                    { status: 400 },
                )
            }
            if (templateIdList.length > 1) {
                return NextResponse.json(
                    { error: "Only one template can be associated with a campaign at this time" },
                    { status: 400 },
                )
            }
        }

        const customerListProvided = Object.prototype.hasOwnProperty.call(body, "customerListId")
        let normalizedCustomerListId: string | undefined
        if (customerListProvided) {
            if (typeof customerListId !== "string" || !customerListId.trim()) {
                return NextResponse.json(
                    { error: "customerListId must be a valid ID" },
                    { status: 400 },
                )
            }
            normalizedCustomerListId = customerListId.trim()
        }

        const nextTemplateId = templateIdList ? templateIdList[0] : existing.templates[0]?.template?.id
        if (!nextTemplateId) {
            return NextResponse.json(
                { error: "Campaign does not have an associated template" },
                { status: 500 },
            )
        }

        const shouldValidateFields = templateIdsProvided || customerListProvided
        const templateRecord = shouldValidateFields
            ? await refreshTemplateDependencies({
                  prisma,
                  templateId: nextTemplateId,
                  businessId: auth.businessId,
              })
            : templateIdList
              ? await prisma.templates.findUnique({
                    where: { id: nextTemplateId },
                    select: {
                        id: true,
                        title: true,
                        requiredFields: true,
                    },
                })
              : existing.templates[0]?.template

        if (!templateRecord) {
            return NextResponse.json(
                { error: "Selected template was not found" },
                { status: 404 },
            )
        }

        const targetContactListId = normalizedCustomerListId ?? existing.contactListId
        const contactListRecord = normalizedCustomerListId
            ? await prisma.contactList.findUnique({
                  where: { id: targetContactListId },
                  include: {
                      _count: {
                          select: { customers: true },
                      },
                  },
              })
            : existing.contactlist

        if (!contactListRecord) {
            return NextResponse.json(
                { error: "Customer list not found" },
                { status: 404 },
            )
        }

        if (shouldValidateFields) {
            const normalizedCustomerFields = toFieldNameSet(contactListRecord.fields)
            const missingFields = Array.isArray(templateRecord.requiredFields)
                ? templateRecord.requiredFields.filter(
                      (field: unknown) =>
                          typeof field === "string" && !normalizedCustomerFields.has(normalizeFieldName(field)),
                  )
                : []

            if (missingFields.length) {
                return NextResponse.json(
                    {
                        error: "Customer list is missing required fields referenced by the selected template",
                        missingFields,
                        template: templateRecord.title,
                    },
                    { status: 400 },
                )
            }
        }

        const data: Prisma.CampaignUncheckedUpdateInput = {}
        if (trimmedName !== undefined) {
            data.name = trimmedName
        }
        if (scheduledDate) {
            data.scheduledAt = scheduledDate,
            data.scheduleStatus = scheduledDate > new Date() ? "PENDING" : existing.scheduleStatus
        }
        if (normalizedCustomerListId) {
            data.contactListId = normalizedCustomerListId
            data.totalRecords = contactListRecord._count?.customers ?? 0
        }

        if (templateIdList) {
            data.templates = {
                deleteMany: {},
                create: templateIdList.map((templateId) => ({
                    template: { connect: { id: templateId } },
                })),
            }
        }

        const updated = await prisma.campaign.update({
            where: { id: campaignId },
            data,
            include: {
                templates: {
                    include: {
                        template: true,
                    },
                    orderBy: { createdAt: "asc" },
                },
                logs: {
                    orderBy: { createdAt: "desc" },
                    take: 5,
                },
            },
        })

        return NextResponse.json(updated)
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || "Failed to update campaign" },
            { status: 500 },
        )
    }
}

/**
 * @swagger
 * /api/campaigns/{id}:
 *   delete:
 *     summary: Delete a campaign and its associated files
 *     tags:
 *       - Campaigns
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign deleted successfully
 *       400:
 *         description: Missing campaign ID or no active business selected
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Campaign not found
 *       500:
 *         description: Failed to delete campaign
 */
export async function DELETE(req: NextRequest, { params }: PatchContext) {
    try {
        const auth = await requireAuth(req)
        if (!auth.ok) return auth.response
        if (!auth.businessId) {
            return NextResponse.json(
                { error: "No active business selected" },
                { status: 400 },
            )
        }

        const hasPermission = await userHasPermissionAPI(req, [
            UserRole.OWNER,
            UserRole.ADMIN,
            UserRole.MEMBER,
        ])
        if (!hasPermission) {
            return NextResponse.json(
                { error: "Insufficient permissions" },
                { status: 403 },
            )
        }

        const { id: campaignId } = await params
        if (!campaignId) {
            return NextResponse.json(
                { error: "Campaign ID is required" },
                { status: 400 },
            )
        }

        const prisma = await getBusinessPrisma(auth.businessId)

        const existing = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
                files: {
                    select: {
                        id: true,
                        filePath: true,
                    },
                },
            },
        })

        if (!existing) {
            return NextResponse.json(
                { error: "Campaign not found" },
                { status: 404 },
            )
        }

        if (existing.files.length > 0) {
            const storageService = getStorageService()
            if (!storageService) {
                return NextResponse.json(
                    {
                        error: "Storage service not configured, cannot delete campaign files safely",
                    },
                    { status: 500 },
                )
            }

            for (const file of existing.files) {
                await storageService.deleteFile(file.filePath)
            }

            await prisma.campaignFile.deleteMany({
                where: {
                    id: {
                        in: existing.files.map((file) => file.id),
                    },
                },
            })
        }

        await prisma.campaign.delete({
            where: { id: campaignId },
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || "Failed to delete campaign" },
            { status: 500 },
        )
    }
}
