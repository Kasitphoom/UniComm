import prismaMain from "@/lib/prisma-main"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { NextRequest } from "next/server"
import { UserBusinessRole } from "@/app/generated/main/prisma"

/**
 * @swagger
 * /api/business:
 *   post:
 *     summary: Create a new business
 *     tags:
 *       - Business
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               ownerEmail:
 *                 type: string
 *     responses:
 *       200:
 *         description: Business created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                  type: string
 *                 ownerEmail:
 *                  type: string
 */

export async function POST(request: NextRequest) {
    let createdBusinessId: string | null = null
    try {
        const body = await request.json()

        // Create the Business record in main DB (no payload required per schema)
        const newBusinessRecord = await prismaMain.business.create({ data: {} })
        createdBusinessId = newBusinessRecord.id

        // Create per-business database: business_<id>
        const databaseName = `business_${newBusinessRecord.id}`
        const prismaBusiness = getBusinessPrisma(newBusinessRecord.id)
        try {
            // Creating a record to initialize DB and collection
            await prismaBusiness.systemSettings.create({ data: {
                name: body.name
            } })

            await prismaBusiness.businessUser.create({
                data: {
                    email: body.ownerEmail,
                    role: 'OWNER',
                },
            })

        } finally {
            await prismaBusiness.$disconnect()
        }

        // Ensure a main User exists and associate it to this Business as OWNER
        if (body?.ownerEmail) {
            const owner = await prismaMain.user.upsert({
                where: { email: body.ownerEmail },
                update: {},
                create: { email: body.ownerEmail },
            })
            await prismaMain.usersOnBusinesses.create({
                data: {
                    userId: owner.id,
                    businessId: newBusinessRecord.id,
                    role: UserBusinessRole.OWNER,
                },
            })
        }

        return new Response(
            JSON.stringify({
                ...newBusinessRecord,
                database: databaseName,
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        )
    } catch (error) {
        // Best-effort cleanup if per-business DB creation failed after main record
        if (createdBusinessId) {
            try {
                await prismaMain.business.delete({ where: { id: createdBusinessId } })
            } catch {
                // swallow cleanup errors
            }
        }
        return new Response(
            JSON.stringify({
                msg: "Unable to create business",
                error: error instanceof Error ? error.message : String(error),
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        )
    }
}
