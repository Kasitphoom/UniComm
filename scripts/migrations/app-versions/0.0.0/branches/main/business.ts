import type { PrismaClient } from "../../../../../../app/generated/business/prisma"
import type { BusinessMigration } from "../../../../types"

export const migrations: Array<BusinessMigration<PrismaClient>> = [
    {
        name: "2026-01-28-business-init-migrations",
        description: "Initialize migration collection in business databases",
        up: async () => {
            // No-op: Migration collection is created on first insert.
        },
    },
]
