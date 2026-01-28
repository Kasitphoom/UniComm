import type { PrismaClient } from "../../../../../../app/generated/business/prisma"
import type { BusinessMigration } from "../../../../types"
import { ObjectId } from "bson"

export const migrations: Array<BusinessMigration<PrismaClient>> = [
    {
        name: "convert-ids-to-objectid",
        description:
            "Convert all IDs to MongoDB ObjectId for Templates, TemplateVersion, ComponentBlock, and ComponentBlockVersion models",
        up: async ({ prisma }) => {
            console.log("Starting native ObjectId conversion...")

            const collections = [
                {
                    name: "Templates",
                    fields: ["userId", "contactListId"],
                },
                {
                    name: "TemplateVersion",
                    fields: ["templateId"],
                },
                {
                    name: "ComponentBlock",
                    fields: ["userId"],
                },
                {
                    name: "ComponentBlockVersion",
                    fields: ["componentBlockId"],
                },
            ]

            for (const coll of collections) {
                console.log(`Converting fields in ${coll.name}...`)

                // Construct the $set stage dynamically for the aggregation
                const setStage: any = {}
                coll.fields.forEach((field) => {
                    setStage[field] = {
                        $cond: {
                            if: {
                                $and: [
                                    { $ne: [`$${field}`, null] },
                                    { $toObjectId: `$${field}` }, // This is the magic part
                                ],
                            },
                            then: { $toObjectId: `$${field}` },
                            else: `$${field}`,
                        },
                    }
                })

                // Run raw MongoDB command to update types
                await (prisma as any).$runCommandRaw({
                    update: coll.name,
                    updates: [
                        {
                            q: {}, // Match all documents
                            u: [{ $set: setStage }], // Apply conversion
                            multi: true,
                        },
                    ],
                })

                console.log(`Successfully converted ${coll.name}`)
            }

            console.log("Native ID conversion completed.")
        },
    },
]
