import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import type { BusinessMigration, MainMigration } from "./types"

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const migrationsRoot = path.join(currentDir, "app-versions")

export const listBranches = (version: string) => {
    const branchesRoot = path.join(migrationsRoot, version, "branches")
    if (!fs.existsSync(branchesRoot)) return []
    return fs
        .readdirSync(branchesRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
}

const resolveModuleUrl = (
    version: string,
    branch: string,
    db: "main" | "business",
) => {
    const modulePath = path.join(
        migrationsRoot,
        version,
        "branches",
        branch,
        `${db}.ts`,
    )
    return pathToFileURL(modulePath).toString()
}

const moduleExists = (
    version: string,
    branch: string,
    db: "main" | "business",
) => {
    const modulePath = path.join(
        migrationsRoot,
        version,
        "branches",
        branch,
        `${db}.ts`,
    )
    return fs.existsSync(modulePath)
}

const loadModule = async <T>(
    version: string,
    branch: string,
    db: "main" | "business",
) => {
    const resolvedBranch = moduleExists(version, branch, db) ? branch : "main"
    if (!moduleExists(version, resolvedBranch, db)) return [] as T[]
    const moduleUrl = resolveModuleUrl(version, resolvedBranch, db)
    const migrationModule = await import(moduleUrl)
    return (migrationModule.migrations || migrationModule.default || []) as T[]
}

export const loadMainMigrationsForVersion = async (
    version: string,
    branches: string[],
) => {
    const all: Array<MainMigration<any>> = []
    for (const branch of branches) {
        const migrations = await loadModule<MainMigration<any>>(
            version,
            branch,
            "main",
        )
        all.push(...migrations)
    }
    return all
}

export const loadBusinessMigrationsForVersion = async (
    version: string,
    branches: string[],
) => {
    const all: Array<BusinessMigration<any>> = []
    for (const branch of branches) {
        const migrations = await loadModule<BusinessMigration<any>>(
            version,
            branch,
            "business",
        )
        all.push(...migrations)
    }
    return all
}
