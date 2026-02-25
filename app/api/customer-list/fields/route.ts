import { UserRole } from "@/app/generated/business/prisma"
import { requireAuth } from "@/lib/api-auth"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { userHasPermissionAPI } from "@/utils/permissions"
import { NextRequest, NextResponse } from "next/server"

type ContactListField = {
    field: string
    type: string
}

type ContactListFieldGroup = {
    listId: string
    listName: string
    fields: ContactListField[]
}

export const GET = async (request: NextRequest) => {
    try {
        const auth = await requireAuth(request)
        if (!auth.ok) return auth.response

        const hasPermission = await userHasPermissionAPI(request, [
            UserRole.OWNER,
            UserRole.ADMIN,
            UserRole.MEMBER,
        ])
        if (!hasPermission) {
            return NextResponse.json(
                { error: "Insufficient permissions." },
                { status: 403 },
            )
        }

        const prisma = await getBusinessPrisma(auth.businessId!)

        const contactLists = await prisma.contactList.findMany({
            select: {
                id: true,
                name: true,
                fields: true,
            },
        })

        const fieldMap = new Map<string, string>()
        const groups: ContactListFieldGroup[] = []

        for (const list of contactLists) {
            const fields = Array.isArray(list.fields)
                ? list.fields
                : []

            const groupFields: ContactListField[] = []

            for (const item of fields) {
                const fieldName =
                    item && typeof item === "object" && "field" in item
                        ? String((item as { field?: unknown }).field ?? "").trim()
                        : ""
                const fieldType =
                    item && typeof item === "object" && "type" in item
                        ? String((item as { type?: unknown }).type ?? "string").trim()
                        : "string"

                if (!fieldName) continue
                if (!fieldMap.has(fieldName)) {
                    fieldMap.set(fieldName, fieldType || "string")
                }

                groupFields.push({
                    field: fieldName,
                    type: fieldType || "string",
                })
            }

            groups.push({
                listId: list.id,
                listName: list.name,
                fields: groupFields,
            })
        }

        const normalizedGroups = groups
            .map((group) => {
                const uniqueByField = new Map<string, ContactListField>()
                for (const field of group.fields) {
                    if (!uniqueByField.has(field.field)) {
                        uniqueByField.set(field.field, field)
                    }
                }

                return {
                    ...group,
                    fields: Array.from(uniqueByField.values()).sort((a, b) =>
                        a.field.localeCompare(b.field),
                    ),
                }
            })
            .sort((a, b) => a.listName.localeCompare(b.listName))

        const fields: ContactListField[] = Array.from(fieldMap.entries())
            .map(([field, type]) => ({ field, type }))
            .sort((a, b) => a.field.localeCompare(b.field))

        return NextResponse.json({ fields, groups: normalizedGroups }, { status: 200 })
    } catch (error) {
        console.error("Error fetching customer list fields:", error)
        return NextResponse.json(
            { error: "Failed to fetch customer list fields." },
            { status: 500 },
        )
    }
}
