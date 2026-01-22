import { UserRole } from "@/app/generated/business/prisma";
import { requireAuth } from "@/lib/api-auth";
import { getBusinessPrisma } from "@/lib/prisma-business";
import { userHasPermissionAPI } from "@/utils/permissions";
import { NextRequest, NextResponse } from "next/server";

export const PATCH = async ( request: NextRequest, context: { params: Promise<{ id: string, customerId: string }> } ) => {
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

        const { id, customerId } = await context.params;
        const body = await request.json();
        const { data } = body as { data: Record<string, string> };

        if (!data) {
            return NextResponse.json({ error: "Customer data is required." }, { status: 400 });
        }

        const availableFields = await prisma.contactList.findFirst({
            where: { id },
            select: { fields: true },
        }) as { fields: { field: string; type: string }[] };

        if (!availableFields) {
            return NextResponse.json({ error: "Contact list not found." }, { status: 404 });
        }

        const invalidFields = Object.keys(data).filter(
            (key) => !availableFields.fields?.some((field) => field.field === key)
        );

        if (invalidFields.length > 0) {
            return NextResponse.json(
                { error: `Invalid fields: ${invalidFields.join(", ")}` },
                { status: 400 }
            );
        }

        const updatedCustomer = await prisma.customer.update({
            where: { id: customerId, listId: id },
            data: {
                data,
            },
        });

        return NextResponse.json({ customer: updatedCustomer }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ error: "Failed to update customer." }, { status: 500 });
    }
}