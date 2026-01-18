import { requireAuth } from "@/lib/api-auth";
import { getBusinessPrisma } from "@/lib/prisma-business";
import { NextRequest, NextResponse } from "next/server";

export const PATCH = async ( request: NextRequest, context: { params: Promise<{ id: string }> } ) => {
    try {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

        const prisma = await getBusinessPrisma(auth.businessId!);

        if (!prisma) {
            return NextResponse.json({ error: "Business database not found." }, { status: 404 });
        }

        const { id } = await context.params;
        const body = await request.json();
        const { name, remarks } = body;

        if (!name || name.trim().length === 0) {
            return NextResponse.json({ error: "Name is required." }, { status: 400 });
        }

        const updatedList = await prisma.contactList.update({
            where: { id },
            data: {
                name,
                remarks,
            },
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
        type CustomerRecord = { id: string; listId: string; data: any; createdAt: Date; updatedAt: Date };
        let customers: CustomerRecord[] = [];

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
        return NextResponse.json({ error: "Failed to fetch contact list." }, { status: 500 });
    }
}