import { requireAuth } from "@/lib/api-auth";
import { getBusinessPrisma } from "@/lib/prisma-business";
import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";

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

export const POST = async ( request: NextRequest ) => {
    try {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

        const prisma = await getBusinessPrisma(auth.businessId!);

        if (!prisma) {
            return NextResponse.json({ error: "Business database not found." }, { status: 404 });
        }

        // Check if request has file upload (multipart/form-data) or JSON
        const contentType = request.headers.get("content-type") || "";
        
        if (contentType.includes("multipart/form-data")) {
            // Handle CSV file upload
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

            // Validate file type
            if (!file.name.endsWith(".csv")) {
                return NextResponse.json({ error: "Only CSV files are allowed." }, { status: 400 });
            }

            // Read file content
            const fileContent = await file.text();
            
            // Parse CSV
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

            // Extract field names from CSV headers and infer types from first row
            const firstRecord = records[0];
            const fields: { field: string; type: string }[] = Object.keys(firstRecord).map(key => {
                const value = firstRecord[key];
                let type = "string"; // Default to string

                // Infer type from value
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

            // Use transaction to ensure both contact list and customers are created atomically
            const result = await prisma.$transaction(async (tx) => {
                // Create the contact list with CSV_UPLOAD source
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

                // Create customers from CSV records
                const customers = records.map(record => ({
                    listId: contactList.id,
                    data: record, // Each row's data as JSON object
                }));

                // Bulk insert customers
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
            // Handle manual creation (JSON body)
            const body = await request.json();
            const { name, source, remarks, upsertMode } = body;

            // Validate required fields
            if (!name || typeof name !== "string" || name.trim().length === 0) {
                return NextResponse.json({ error: "Name is required." }, { status: 400 });
            }

            // Validate source if provided
            const validSources = ["MANUAL", "SALESFORCE"];
            if (source && !validSources.includes(source)) {
                return NextResponse.json({ error: "Invalid source. Must be MANUAL or SALESFORCE." }, { status: 400 });
            }

            // Create empty contact list for manual creation
            const contactList = await prisma.contactList.create({
                data: {
                    name: name.trim(),
                    source: source || "MANUAL",
                    remarks: remarks || null,
                    fields: [],
                    upsertMode,
                },
            });

            return NextResponse.json({ contactList }, { status: 201 });
        }

    } catch (error: any) {
        // Handle duplicate name error
        if (error.code === "P2002") {
            return NextResponse.json({ error: "A contact list with this name already exists." }, { status: 409 });
        }
        
        console.error("Error creating contact list:", error);
        return NextResponse.json({ error: "Failed to create contact list." }, { status: 500 });
    }
}