import { Customer, UserRole } from "@/app/generated/business/prisma";
import { requireAuth } from "@/lib/api-auth";
import { getBusinessPrisma } from "@/lib/prisma-business";
import { userHasPermissionAPI } from "@/utils/permissions";
import { NextRequest, NextResponse } from "next/server";

export const PATCH = async ( request: NextRequest, context: { params: Promise<{ id: string }> } ) => {
    try {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

        const userHasPermission = userHasPermissionAPI(request, [UserRole.OWNER, UserRole.ADMIN])
        if (!userHasPermission) {
            return NextResponse.json(
                { error: "Insufficient permissions." },
                { status: 403 },
            )
        }

        const prisma = await getBusinessPrisma(auth.businessId!);

        if (!prisma) {
            return NextResponse.json({ error: "Business database not found." }, { status: 404 });
        }

        const { id } = await context.params;
        const body = await request.json();
        const { name, remarks, primaryKey, upsertMode, fields } = body;

        if (!name || name.trim().length === 0) {
            return NextResponse.json({ error: "Name is required." }, { status: 400 });
        }

        // Get the current contact list to track field changes
        const currentList = await prisma.contactList.findUnique({
            where: { id },
        });

        if (!currentList) {
            return NextResponse.json({ error: "Contact list not found." }, { status: 404 });
        }

        // Build update data - only include optional fields if provided
        const updateData: any = {
            name,
            remarks,
        };

        if (primaryKey !== undefined) updateData.primaryKey = primaryKey;

        if (upsertMode !== undefined) updateData.upsertMode = upsertMode;

        // Track field name changes for data migration
        const fieldNameMapping: { [oldName: string]: string } = {};

        if (fields && Array.isArray(fields)) {
            // Convert field objects to the expected format
            const convertedFields = fields.map((field: any) => ({
                field: field.name,
                type: field.type,
            }));
            updateData.fields = convertedFields;

            // If primaryKey exists and fields are being updated, verify primaryKey still exists in new fields
            // If the primary key field was renamed, we need to handle this case
            if (primaryKey) {
                const primaryKeyExists = convertedFields.some((f: any) => f.field === primaryKey);
                if (!primaryKeyExists) {
                    // Primary key field might have been renamed, but we'll let the client handle the mapping
                    // The client should send the updated primaryKey if a field was renamed
                    return NextResponse.json(
                        { error: "Primary key field does not exist in the updated fields. Please update the primary key field name." },
                        { status: 400 }
                    );
                }
            }

            // Build field name mapping from old to new fields
            const oldFields = Array.isArray(currentList.fields) ? currentList.fields : [];
            const oldFieldMap = new Map(
                oldFields
                    .filter((f: any): f is { field: string; type: string } =>
                        typeof f === "object" && f !== null && "field" in f
                    )
                    .map((f: any, idx: number) => [idx, f.field])
            );

            // Match old fields to new fields by position and track renames
            convertedFields.forEach((newField: any, idx: number) => {
                const oldFieldName = oldFieldMap.get(idx);
                if (oldFieldName && oldFieldName !== newField.field) {
                    fieldNameMapping[oldFieldName] = newField.field;
                }
            });
        }

        // Migrate customer data if field names changed
        if (Object.keys(fieldNameMapping).length > 0) {
            const customers = await prisma.customer.findMany({
                where: { listId: id },
            });

            for (const customer of customers) {
                const updatedData: any = typeof customer.data === "object" && customer.data !== null 
                    ? { ...customer.data } 
                    : {};
                let hasChanges = false;

                for (const [oldName, newName] of Object.entries(fieldNameMapping)) {
                    if (oldName in updatedData && !(newName in updatedData)) {
                        updatedData[newName] = updatedData[oldName];
                        delete updatedData[oldName];
                        hasChanges = true;
                    }
                }

                if (hasChanges) {
                    await prisma.customer.update({
                        where: { id: customer.id },
                        data: { data: updatedData },
                    });
                }
            }
        }

        const updatedList = await prisma.contactList.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({ contactList: updatedList }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ error: "Failed to update contact list." }, { status: 500 });
    }
}

export const DELETE = async ( request: NextRequest, context: { params: Promise<{ id: string }> } ) => {
    try {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

        const userHasPermission = userHasPermissionAPI(request, [UserRole.OWNER, UserRole.ADMIN])
        if (!userHasPermission) {
            return NextResponse.json(
                { error: "Insufficient permissions." },
                { status: 403 },
            )
        }

        const prisma = await getBusinessPrisma(auth.businessId!);

        if (!prisma) {
            return NextResponse.json({ error: "Business database not found." }, { status: 404 });
        }

        const { id } = await context.params;

        await prisma.contactList.delete({
            where: { id },
        });

        return NextResponse.json({ message: "Contact list deleted successfully." }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ error: "Failed to delete contact list." }, { status: 500 });
    }
}

export const GET = async ( request: NextRequest, context: { params: Promise<{ id: string }> } ) => {
    try {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

        const prisma = await getBusinessPrisma(auth.businessId!);

        if (!prisma) {
            return NextResponse.json({ error: "Business database not found." }, { status: 404 });
        }

        const { id } = await context.params;

        // Parse pagination and search from query params
        const url = new URL(request.url);
        const pageParam = url.searchParams.get("page");
        const pageSizeParam = url.searchParams.get("pageSize");
        const q = url.searchParams.get("q")?.trim() || "";

        const page = Math.max(parseInt(pageParam || "1", 10) || 1, 1);
        const pageSize = Math.min(Math.max(parseInt(pageSizeParam || "20", 10) || 20, 1), 200);
        const skip = (page - 1) * pageSize;

        // Ensure list exists and get basic info + count
        const contactList = await prisma.contactList.findUnique({
            where: { id },
            include: {
                _count: { select: { customers: true } },
            },
        });

        if (!contactList) {
            return NextResponse.json({ error: "Contact list not found." }, { status: 404 });
        }

        // If there is a search query, fetch all customers for the list and filter in application layer.
        // MongoDB + Prisma JSON filters are limited; application-side filtering ensures search across dynamic fields in `data`.
        let total = contactList._count.customers || 0;
        let customers: Customer[] = [];

        if (q) {
            const all = await prisma.customer.findMany({
                where: { listId: id },
                orderBy: { createdAt: "desc" },
            });

            // Case-insensitive match across all primitive values in `data`
            const qLower = q.toLowerCase();
            const matches = all.filter((c) => {
                const values: string[] = [];
                const collect = (val: any) => {
                    if (val == null) return;
                    if (typeof val === "string") values.push(val);
                    else if (typeof val === "number" || typeof val === "boolean") values.push(String(val));
                    else if (Array.isArray(val)) val.forEach(collect);
                    else if (typeof val === "object") Object.values(val).forEach(collect);
                };
                collect(c.data);
                // Also include date strings
                values.push(new Date(c.createdAt).toLocaleString());
                values.push(new Date(c.updatedAt).toLocaleString());

                return values.some((v) => v.toLowerCase().includes(qLower));
            });

            total = matches.length;
            customers = matches.slice(skip, skip + pageSize);
        } else {
            customers = await prisma.customer.findMany({
                where: { listId: id },
                orderBy: { createdAt: "desc" },
                skip,
                take: pageSize,
            });
        }

        const totalPages = Math.max(Math.ceil(total / pageSize), 1);

        return NextResponse.json(
            {
                contactList,
                customers: {
                    items: customers,
                    page,
                    pageSize,
                    total,
                    totalPages,
                },
            },
            { status: 200 }
        );

    } catch (error) {
        return NextResponse.json({ error: error }, { status: 500 });
    }
}