import { PrismaClient as MainPrismaClient } from "../../app/generated/main/prisma"
import { PrismaClient as BusinessPrismaClient } from "../../app/generated/business/prisma"
import { buildBusinessDbUrl } from "../../lib/prisma-business"
import type { BusinessMigration, MainMigration, MigrationDb } from "./types"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
    listBranches,
    loadBusinessMigrationsForVersion,
    loadMainMigrationsForVersion,
} from "./helpers"

const parseDbArg = (): MigrationDb | "both" => {
    const arg = process.argv.find((item) => item.startsWith("--db="))
    const value = arg?.split("=")[1]
    if (value === "main" || value === "business" || value === "both")
        return value
    return "both"
}

const parseVersionArg = (): string | null => {
    const arg = process.argv.find((item) => item.startsWith("--v") || item.startsWith("-v"))
    if (!arg) return null
    
    // Handle --v=value or -v=value
    if (arg.includes("=")) {
        return arg.split("=")[1]
    }
    
    // Handle -v value or --v value (space-separated)
    const argIndex = process.argv.indexOf(arg)
    if (argIndex !== -1 && argIndex + 1 < process.argv.length) {
        const nextArg = process.argv[argIndex + 1]
        if (!nextArg.startsWith("-")) {
            return nextArg
        }
    }
    
    return null
}

const getCurrentAppVersion = () => {
    const currentDir = path.dirname(fileURLToPath(import.meta.url))
    const packageJsonPath = path.resolve(currentDir, "../../package.json")
    const raw = fs.readFileSync(packageJsonPath, "utf-8")
    const parsed = JSON.parse(raw) as { version?: string }
    if (!parsed.version) {
        throw new Error("package.json version is missing")
    }
    return parsed.version
}

const applyMainMigrations = async (
    prisma: MainPrismaClient,
    migrations: Array<MainMigration<MainPrismaClient>>,
) => {
    const applied = await prisma.migration.findMany({ select: { name: true } })
    const appliedNames = new Set(applied.map((item) => item.name))

    for (const migration of migrations) {
        if (appliedNames.has(migration.name)) continue
        await migration.up({ prisma })
        await prisma.migration.create({ data: { name: migration.name } })
        console.info(`[main] Applied migration: ${migration.name}`)
    }
}

const applyBusinessMigrations = async (
    prisma: BusinessPrismaClient,
    businessId: string,
    migrations: Array<BusinessMigration<BusinessPrismaClient>>,
) => {
    const applied = await prisma.migration.findMany({ select: { name: true } })
    const appliedNames = new Set(applied.map((item) => item.name))

    for (const migration of migrations) {
        if (appliedNames.has(migration.name)) continue
        await migration.up({ prisma, businessId })
        await prisma.migration.create({ data: { name: migration.name } })
        console.info(
            `[business:${businessId}] Applied migration: ${migration.name}`,
        )
    }
}

const runMainVersion = async (version: string) => {
    const prisma = new MainPrismaClient()
    try {
        const branches = listBranches(version)
        const migrations = await loadMainMigrationsForVersion(version, branches)
        await applyMainMigrations(prisma, migrations)
    } finally {
        await prisma.$disconnect()
    }
}

const runBusinessVersion = async (version: string) => {
    const prismaMain = new MainPrismaClient()

    try {
        const businesses = await prismaMain.business.findMany({
            select: { id: true },
        })
        const branches = listBranches(version)
        const migrations = await loadBusinessMigrationsForVersion(
            version,
            branches,
        )
        console.log(`[DEBUG] Found ${migrations.length} business migrations for version ${version}`)
        migrations.forEach(m => console.log(`[DEBUG] Migration: ${m.name} - ${m.description}`))

        for (const business of businesses) {
            const url = buildBusinessDbUrl(business.id)
            const prismaBusiness = new BusinessPrismaClient({
                datasources: { db: { url } },
            })
            try {
                await applyBusinessMigrations(
                    prismaBusiness,
                    business.id,
                    migrations,
                )
            } finally {
                await prismaBusiness.$disconnect()
            }
        }
    } finally {
        await prismaMain.$disconnect()
    }
}

const run = async () => {
    const target = parseDbArg()
    const version = parseVersionArg() ?? getCurrentAppVersion()

    if (target === "both" || target === "main") {
        await runMainVersion(version)
    }

    if (target === "both" || target === "business") {
        await runBusinessVersion(version)
    }
    return
}

run().then(() => {
    console.log("Migrations completed successfully.")
}).catch((error) => {
    console.error("Migration failed:", error)
    process.exit(1)
})
