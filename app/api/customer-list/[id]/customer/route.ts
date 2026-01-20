import { requireAuth } from "@/lib/api-auth"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { NextRequest, NextResponse } from "next/server"
import { parse } from "csv-parse/sync"
import { userHasPermissionAPI } from "@/utils/permissions"
import { UserRole } from "@/app/generated/business/prisma"

export const POST = async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) => {
    try {
        const auth = await requireAuth(request)
        if (!auth.ok) return auth.response

        const userHasPermission = userHasPermissionAPI(request, [UserRole.OWNER, UserRole.ADMIN])
        if (!userHasPermission) {
            return NextResponse.json(
                { error: "Insufficient permissions." },
                { status: 403 },
            )
        }

        const prisma = await getBusinessPrisma(auth.businessId!)

        if (!prisma) {
            return NextResponse.json(
                { error: "Business database not found." },
                { status: 404 },
            )
        }

        const { id } = await context.params

        // Verify the contact list exists
        const contactList = await prisma.contactList.findUnique({
            where: { id },
        })

        if (!contactList) {
            return NextResponse.json(
                { error: "Contact list not found." },
                { status: 404 },
            )
        }

        // Determine content type and parse accordingly
        const contentType = request.headers.get("content-type") || ""

        let customersToCreate: Array<{ data: Record<string, any> }> = []

        if (contentType.includes("application/json")) {
            // Manual entry mode: expect array of customer objects
            const body = await request.json()
            const customers = Array.isArray(body) ? body : [body]

            if (customers.length === 0) {
                return NextResponse.json(
                    { error: "No customers provided." },
                    { status: 400 },
                )
            }

            customersToCreate = customers.map((customer) => ({
                data: customer,
            }))
        } else if (contentType.includes("multipart/form-data")) {
            // CSV upload mode
            const formData = await request.formData()
            const file = formData.get("file") as File | null

            if (!file) {
                return NextResponse.json(
                    { error: "No CSV file provided." },
                    { status: 400 },
                )
            }

            const csvText = await file.text()
            const records = parse(csvText, {
                columns: true,
                skip_empty_lines: true,
            }) as Array<Record<string, string>>

            if (records.length === 0) {
                return NextResponse.json(
                    { error: "CSV file is empty." },
                    { status: 400 },
                )
            }

            customersToCreate = records.map((record) => ({
                data: record,
            }))
        } else {
            return NextResponse.json(
                { error: "Unsupported content type. Use application/json or multipart/form-data." },
                { status: 415 },
            )
        }

        // Validate primary key if configured
        if (contactList.primaryKey && contactList.primaryKey.trim().length > 0) {
            const pk = contactList.primaryKey.trim()
            const emptyPkCount = customersToCreate.filter((c) => {
                const val = c.data[pk]
                return typeof val !== "string" || val.trim().length === 0
            }).length

            if (emptyPkCount > 0) {
                return NextResponse.json(
                    {
                        error: `${emptyPkCount} customer(s) have empty '${pk}' value. Please ensure all primary key values are filled.`,
                    },
                    { status: 400 },
                )
            }
        }

        // Create or update customers based on upsertMode and primary key
        let totalCount = 0;
        
        if (contactList.upsertMode && contactList.primaryKey && contactList.primaryKey.trim().length > 0) {
            // Upsert mode: update existing by primary key, create if not found
            const pk = contactList.primaryKey.trim();
            
            for (const customer of customersToCreate) {
                const pkValue = customer.data[pk];
                
                // Fetch all customers for this list and check in-memory
                // MongoDB + Prisma JSON filtering is limited, so we check in application layer
                const allCustomers = await prisma.customer.findMany({
                    where: { listId: id },
                });
                
                const existing = allCustomers.find((c) => {
                    const val = c.data as Record<string, any>;
                    return val[pk] === pkValue;
                });

                if (existing) {
                    // Update existing customer
                    await prisma.customer.update({
                        where: { id: existing.id },
                        data: { data: customer.data },
                    });
                } else {
                    // Create new customer
                    await prisma.customer.create({
                        data: {
                            listId: id,
                            data: customer.data,
                        },
                    });
                }
                totalCount++;
            }
        } else {
            // Normal create mode
            const created = await prisma.customer.createMany({
                data: customersToCreate.map((c) => ({
                    listId: id,
                    data: c.data,
                })),
            });
            totalCount = created.count;
        }

        return NextResponse.json(
            {
                count: totalCount,
            },
            { status: 201 },
        )
    } catch (error) {
        console.error("Failed to create customers:", error)
        return NextResponse.json(
            { error: "Failed to create customers." },
            { status: 500 },
        )
    }
}

export const DELETE = async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) => {
    try {
        const auth = await requireAuth(request)
        if (!auth.ok) return auth.response

        const userHasPermission = userHasPermissionAPI(request, [UserRole.OWNER, UserRole.ADMIN])
        if (!userHasPermission) {
            return NextResponse.json(
                { error: "Insufficient permissions." },
                { status: 403 },
            )
        }

        const prisma = await getBusinessPrisma(auth.businessId!)

        if (!prisma) {
            return NextResponse.json(
                { error: "Business database not found." },
                { status: 404 },
            )
        }

        const { id } = await context.params
        const { ids } = await request.json() as { ids: string[] }

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                { error: "No customer IDs provided." },
                { status: 400 },
            )
        }

        await prisma.customer.deleteMany({
            where: { id: { in: ids }, listId: id },
        })

        return NextResponse.json(
            { message: "Contact list deleted successfully." },
            { status: 200 },
        )
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to delete contact list." },
            { status: 500 },
        )
    }
}
