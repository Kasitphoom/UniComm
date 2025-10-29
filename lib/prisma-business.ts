import { PrismaClient } from '../app/generated/business/prisma'

/**
 * Build a MongoDB connection string that points to the provided database name,
 * based on the BUSINESS_DATABASE_URL env var.
 */
export function buildBusinessDbUrl(id: string): string {
    const base = process.env.BUSINESS_DATABASE_URL
    if (!base) throw new Error('BUSINESS_DATABASE_URL is not set')
    const u = new URL(base)
    u.pathname = `/business_${id}`
    return u.toString()
}

/**
 * Create a Prisma client instance for a specific business database.
 * Do NOT cache globally because each business uses a distinct DB.
 */
export function getBusinessPrisma(id: string) {
    const url = buildBusinessDbUrl(id)
    return new PrismaClient({ datasources: { db: { url } } })
}

// Backwards-compatible default export for environments using a single business DB from env
// Not used for multi-tenant per-business DBs; prefer getBusinessPrisma(dbName)
const defaultClient = new PrismaClient()
export default defaultClient