/**
 * E2E seed script — inserts minimal data into `business_business-a` so that
 * the campaign detail SSR page can render without hitting notFound().
 *
 * IDs are fixed so the Playwright test can reference them by value.
 */
import { PrismaClient } from "../app/generated/business/prisma"

const CAMPAIGN_ID = "507f1f77bcf86cd799439011"
const CONTACT_LIST_ID = "507f1f77bcf86cd799439022"
const USER_ID = "507f1f77bcf86cd799439033"
const TEMPLATE_ID = "507f1f77bcf86cd799439044"
const CAMPAIGN_TEMPLATE_ID = "507f1f77bcf86cd799439055"

const BUSINESS_DB_URL = (() => {
    const base = process.env.BUSINESS_DATABASE_URL
    if (!base) throw new Error("BUSINESS_DATABASE_URL is not set")
    const u = new URL(base)
    u.pathname = "/business_business-a"
    return u.toString()
})()

const prisma = new PrismaClient({ datasources: { db: { url: BUSINESS_DB_URL } } })

async function main() {
    await prisma.businessUser.upsert({
        where: { id: USER_ID },
        update: {},
        create: {
            id: USER_ID,
            email: "owner@business-a.com",
            displayName: "Owner",
            role: "OWNER",
        },
    })

    await prisma.contactList.upsert({
        where: { id: CONTACT_LIST_ID },
        update: {},
        create: {
            id: CONTACT_LIST_ID,
            name: "CSV Leads",
            fields: [
                { field: "email", type: "email" },
                { field: "first_name", type: "string" },
            ],
            primaryKey: "email",
            upsertMode: true,
        },
    })

    await prisma.templates.upsert({
        where: { id: TEMPLATE_ID },
        update: {},
        create: {
            id: TEMPLATE_ID,
            title: "Offer Template",
            filePath: "e2e/placeholder.pdf",
            userId: USER_ID,
            contactListId: CONTACT_LIST_ID,
            requiredFields: ["email"],
        },
    })

    await prisma.campaign.upsert({
        where: { id: CAMPAIGN_ID },
        update: {},
        create: {
            id: CAMPAIGN_ID,
            name: "E2E Existing Campaign Detail",
            contactListId: CONTACT_LIST_ID,
            scheduledAt: new Date("2026-03-27T18:00:00.000Z"),
            scheduleStatus: "PENDING",
            fileStatus: "EMPTY",
            totalRecords: 25,
        },
    })

    await prisma.campaignTemplate.upsert({
        where: { id: CAMPAIGN_TEMPLATE_ID },
        update: {},
        create: {
            id: CAMPAIGN_TEMPLATE_ID,
            campaignId: CAMPAIGN_ID,
            templateId: TEMPLATE_ID,
        },
    })

    console.log("E2E seed complete.")
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
