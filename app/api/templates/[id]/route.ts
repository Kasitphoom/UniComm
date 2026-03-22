import { NextRequest, NextResponse } from "next/server"
import {
    getBusinessPrisma,
    getBusinessPrismaByCookie,
} from "@/lib/prisma-business"
import { Schema, Template } from "@pdfme/common"
import { transformTemplateToXml, transformXmlToTemplate } from "@/utils/template/xml-pdf-transformer"
import { requireAuth } from "@/lib/api-auth"
import { getStorageService } from "@/utils/upload/modules"
import { hashTemplate } from "@/lib/draftStore"
import { hasRolePermission, RolePermissions } from "@/lib/role-permissions"
import { UserRole } from "@/app/generated/business/prisma"
import { userHasPermissionAPI } from "@/utils/permissions"

/**
 * @swagger
 * /api/templates/{id}:
 *   get:
 *     summary: Get template details
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
 *         description: Template fetched successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Template not found
 *       500:
 *         description: Failed to fetch template
 */
export async function GET(
    _req: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    try {
        const auth = await requireAuth(_req)
        if (!auth.ok) return auth.response

        const { id } = await context.params

        const prisma = await getBusinessPrisma(auth.businessId!)
        const tpl = await prisma.templates.findUnique({
            where: { id },
            include: {
                user: true,
                versions: true,
                contactList: true,
                approvers: { include: { user: true } },
            },
        })
        if (!tpl)
            return NextResponse.json({ error: "Not found" }, { status: 404 })

        const templateWithApprovalFlag = {
            ...tpl,
            requireUserApproval: tpl.approvers.some(
                (approver) => approver.userId === auth.userId,
            ),
        }

        return NextResponse.json(templateWithApprovalFlag)
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "Failed to fetch template" },
            { status: 500 },
        )
    }
}

/**
 * @swagger
 * /api/templates/{id}:
 *   patch:
 *     summary: Update template content and create a new version
 *     tags:
 *       - Templates
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: PDF template payload
 *     responses:
 *       200:
 *         description: Template updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to update this template
 *       404:
 *         description: Template not found
 *       500:
 *         description: Failed to update template
 */
export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    try {
        const auth = await requireAuth(req)
        if (!auth.ok) return auth.response

        const userHasPermission = await userHasPermissionAPI(req, [
            UserRole.OWNER,
            UserRole.ADMIN,
            UserRole.MEMBER,
        ])

        const { id } = await context.params
        const prisma = await getBusinessPrisma(auth.businessId!)
        const body: Template = await req.json()

        const existingTemplate = await prisma.templates.findUnique({
            where: { id },
        })
        if (!existingTemplate) {
            return NextResponse.json(
                { error: "Template not found" },
                { status: 404 },
            )
        }

        const isTemplateOwner = existingTemplate.userId === auth.userId
        if (!isTemplateOwner || !userHasPermission) {
            return NextResponse.json(
                { error: "You do not have permission to update this template" },
                { status: 403 },
            )
        }

        const storageService = getStorageService()
        if (!storageService) {
            return NextResponse.json(
                { error: "Storage service not configured" },
                { status: 500 },
            )
        }

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
                const parsed = await transformXmlToTemplate(xmlContent)
                const firstPage = parsed.schemas?.[0]
                const result = Array.isArray(firstPage) ? firstPage : null
                cache.set(normalized, result)
                return result
            }
        })()

        const hashedTemplate = await hashTemplate(body)
        const {xml: xmlContent, variables} = await transformTemplateToXml(body, {
            resolveComponentSchemas,
        })

        const fileKey = `${auth.businessId!}/templates/${encodeURIComponent(`${id}.${hashedTemplate}`)}.xml`

        const existingVersions = await prisma.templateVersion.findMany({
            where: { templateId: id, version: hashedTemplate },
            orderBy: { version: "desc" },
            take: 1,
        })

        if (existingVersions.length > 0) {
            const updated = await prisma.templates.update({
                where: { id },
                data: {
                    filePath: existingVersions[0].filePath,
                    requiredFields: variables,
                },
                include: {
                    versions: {
                        where: {
                            version: hashedTemplate,
                        },
                        orderBy: { createdAt: "desc" },
                        take: 1,
                    },
                },
            })

            return NextResponse.json({
                updated,
                xmlPreview: xmlContent.slice(0, 500),
            })
        }

        const newUrl = await storageService.uploadFile(
            Buffer.from(xmlContent, "utf8"),
            fileKey,
        )

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
                requiredFields: variables,
            },
            include: {
                versions: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
            },
        })

        return NextResponse.json({
            updated,
            xmlPreview: xmlContent.slice(0, 500),
        })
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "Failed to update template" },
            { status: 500 },
        )
    }
}

/**
 * @swagger
 * /api/templates/{id}:
 *   delete:
 *     summary: Delete a template and its versions
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
 *         description: Template deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to delete this template
 *       404:
 *         description: Template not found
 *       500:
 *         description: Failed to delete template
 */
export const DELETE = async (
    req: Request,
    context: { params: Promise<{ id: string }> },
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
            },
        })
        if (!existingTemplate) {
            return NextResponse.json(
                { error: "Template not found" },
                { status: 404 },
            )
        }

        // Permission check: Get current user's role
        const currentUser = await prisma.businessUser.findUnique({
            where: { id: auth.userId! },
        })
        if (!currentUser) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 401 },
            )
        }

        // Check if user is owner of the template OR has ADMIN/OWNER role
        const isTemplateOwner = existingTemplate.userId === auth.userId
        const hasAdminAccess = hasRolePermission(
            currentUser.role,
            RolePermissions.ADMIN_AND_OWNER,
        )

        if (!isTemplateOwner && !hasAdminAccess) {
            return NextResponse.json(
                { error: "You do not have permission to delete this template" },
                { status: 403 },
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
            { status: 500 },
        )
    }
}
