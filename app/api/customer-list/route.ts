import { requireAuth } from "@/lib/api-auth";
import { getBusinessPrisma } from "@/lib/prisma-business";
import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { userHasPermissionAPI } from "@/utils/permissions";
import { UserRole } from "@/app/generated/business/prisma";

/**
 * @swagger
 * /api/customer-list:
 *   get:
 *     summary: List customer lists
 *     tags:
 *       - Customer List
 *     responses:
 *       200:
 *         description: Customer lists fetched successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Business database not found
 *       500:
 *         description: Failed to fetch customers
 */
export const GET = async ( request: NextRequest ) => {
    try {

        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

        const prisma = await getBusinessPrisma(auth.businessId!);

        if (!prisma) {
            return NextResponse.json({ error: "Business database not found." }, { status: 404 });
        }

        const contactLists = await prisma.contactList.findMany({
            include: {
                _count: {
                    select: { customers: true }
                }
            }
        })

        return NextResponse.json({ contactLists }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch customers." }, { status: 500 });
    }
}

/**
 * @swagger
 * /api/customer-list:
 *   post:
 *     summary: Create a customer list
 *     tags:
 *       - Customer List
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               source:
 *                 type: string
 *                 enum: [MANUAL, SALESFORCE]
 *               remarks:
 *                 type: string
 *               upsertMode:
 *                 type: boolean
 *               fields:
 *                 type: array
 *                 items:
 *                   type: object
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - file
 *             properties:
 *               name:
 *                 type: string
 *               remarks:
 *                 type: string
 *               upsertMode:
 *                 type: boolean
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Customer list created successfully
 *       400:
 *         description: Invalid payload or CSV format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Business database not found
 *       409:
 *         description: Customer list name already exists
 *       500:
 *         description: Failed to create contact list
 */
export const POST = async ( request: NextRequest ) => {
    try {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

        const userHasPermission = await userHasPermissionAPI(request, [UserRole.OWNER, UserRole.ADMIN])
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

        const contentType = request.headers.get("content-type") || "";
        
        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            const file = formData.get("file") as File | null;
            const name = formData.get("name") as string | null;
            const remarks = formData.get("remarks") as string | null;
            const upsertMode = formData.get("upsertMode") === "true";

            if (!name || name.trim().length === 0) {
                return NextResponse.json({ error: "Name is required." }, { status: 400 });
            }

            if (!file) {
                return NextResponse.json({ error: "CSV file is required." }, { status: 400 });
            }

            if (!file.name.endsWith(".csv")) {
                return NextResponse.json({ error: "Only CSV files are allowed." }, { status: 400 });
            }

            const fileContent = await file.text();
            
            let records: any[];
            try {
                records = parse(fileContent, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true,
                });
            } catch (error) {
                return NextResponse.json({ error: "Invalid CSV format." }, { status: 400 });
            }

            if (records.length === 0) {
                return NextResponse.json({ error: "CSV file is empty." }, { status: 400 });
            }

            const firstRecord = records[0];
            const fields: { field: string; type: string }[] = Object.keys(firstRecord).map(key => {
                const value = firstRecord[key];
                let type = "string";

                if (value !== null && value !== undefined && value !== "") {
                    if (!isNaN(Number(value))) {
                        type = "number";
                    } else if (value.toLowerCase() === "true" || value.toLowerCase() === "false") {
                        type = "boolean";
                    } else if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
                        type = "date";
                    } else if (/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(value)) {
                        type = "email";
                    }
                }

                return { field: key, type };
            });

            const result = await prisma.$transaction(async (tx) => {
                const contactList = await tx.contactList.create({
                    data: {
                        name: name.trim(),
                        source: "CSV_UPLOAD",
                        remarks: remarks || null,
                        primaryKey: fields[0].field,
                        fields: fields,
                        upsertMode: upsertMode,
                    },
                });

                const customers = records.map(record => ({
                    listId: contactList.id,
                    data: record,
                }));

                await tx.customer.createMany({
                    data: customers,
                });

                return {
                    contactList,
                    customersCreated: customers.length,
                };
            });

            return NextResponse.json({ 
                contactList: result.contactList,
                recordsCount: records.length,
                customersCreated: result.customersCreated
            }, { status: 201 });

        } else {
            const body = await request.json();
            const { name, source, remarks, upsertMode, fields } = body;

            if (!name || typeof name !== "string" || name.trim().length === 0) {
                return NextResponse.json({ error: "Name is required." }, { status: 400 });
            }

            const validSources = ["MANUAL", "SALESFORCE"];
            if (source && !validSources.includes(source)) {
                return NextResponse.json({ error: "Invalid source. Must be MANUAL or SALESFORCE." }, { status: 400 });
            }

            let convertedFields: { field: string; type: string }[] = [];
            if (fields && Array.isArray(fields)) {
                convertedFields = fields.map((field: any) => ({
                    field: field.name,
                    type: field.type,
                }));
            }

            if ((source || "MANUAL") === "MANUAL" && convertedFields.length === 0) {
                return NextResponse.json(
                    { error: "At least one field is required for manual lists." },
                    { status: 400 },
                );
            }

            const contactList = await prisma.contactList.create({
                data: {
                    name: name.trim(),
                    source: source || "MANUAL",
                    remarks: remarks || null,
                    primaryKey: convertedFields[0]?.field || "",
                    fields: convertedFields,
                    upsertMode,
                },
            });

            return NextResponse.json({ contactList }, { status: 201 });
        }

    } catch (error: any) {
        if (error.code === "P2002") {
            return NextResponse.json({ error: "A contact list with this name already exists." }, { status: 409 });
        }
        
        console.error("Error creating contact list:", error);
        return NextResponse.json({ error: "Failed to create contact list." }, { status: 500 });
    }
}