import { requireAuth } from "@/lib/api-auth";
import { getBusinessPrisma } from "@/lib/prisma-business";
import { NextRequest, NextResponse } from "next/server";

export const PATCH = async ( request: NextRequest, { params }: { params: { id: string } } ) => {
    try {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

        const prisma = await getBusinessPrisma(auth.businessId!);

        if (!prisma) {
            return NextResponse.json({ error: "Business database not found." }, { status: 404 });
        }

        const { id } = await params;
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

export const DELETE = async ( request: NextRequest, { params }: { params: { id: string } } ) => {
    try {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

        const prisma = await getBusinessPrisma(auth.businessId!);

        if (!prisma) {
            return NextResponse.json({ error: "Business database not found." }, { status: 404 });
        }

        const { id } = await params;

        await prisma.contactList.delete({
            where: { id },
        });

        return NextResponse.json({ message: "Contact list deleted successfully." }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ error: "Failed to delete contact list." }, { status: 500 });
    }
}