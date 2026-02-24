export type MigrationDb = "main" | "business"

export type BaseMigration = {
    name: string
    description: string
}

export type MainMigration<TPrisma> = BaseMigration & {
    up: (ctx: { prisma: TPrisma }) => Promise<void>
}

export type BusinessMigration<TPrisma> = BaseMigration & {
    up: (ctx: { prisma: TPrisma; businessId: string }) => Promise<void>
}
