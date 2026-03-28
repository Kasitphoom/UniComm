import PrismaMain from "@/lib/prisma-main"
import { DEFAULT_BUSINESS_COOKIE } from "@/types/business";
import { cookies } from "next/headers";

export const getBusinessData = async () => {
    // read businessId from cookies
    const cookieStore = await cookies();
    const businessId = cookieStore.get(DEFAULT_BUSINESS_COOKIE)?.value;

    if (process.env.E2E_BYPASS_AUTH === "true") {
        return {
            id: businessId ?? "e2e-business",
            name: "E2E Test Business",
        }
    }

    if (!businessId) {
        throw new Error("Business ID cookie is missing");
    }

    // fetch business data
    const business = await PrismaMain.business.findFirst({
        where: { id: businessId },
        select: {
            id: true,
            name: true,
        },
    });

    if (!business) {
        throw new Error("Business not found");
    }
    
    return business;
}