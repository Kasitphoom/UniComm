import type { PrismaClient } from "../../../../../../app/generated/main/prisma"
import type { MainMigration } from "../../../../types"

export const migrations: Array<MainMigration<PrismaClient>> = [
    {
        name: "2026-01-28-main-init-migrations",
        description: "Initialize migration collection in main database",
        up: async () => {
            // No-op: Migration collection is created on first insert.
        },
    },
]
