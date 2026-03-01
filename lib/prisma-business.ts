import { cookies } from 'next/headers'
import { PrismaClient } from '../app/generated/business/prisma'
import { DEFAULT_BUSINESS_COOKIE } from '@/types/business'

// Cache Prisma clients per business ID to avoid opening new connections on every call
const prismaClientCache = new Map<string, PrismaClient>()

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
 * Get or create a cached Prisma client instance for a specific business database.
 * Reuses existing connections to avoid exhausting the connection pool.
 */
export function getBusinessPrisma(id: string) {
    // Return cached client if it exists
    if (prismaClientCache.has(id)) {
        return prismaClientCache.get(id)!
    }
    
    // Create new client and cache it
    const url = buildBusinessDbUrl(id)
    const client = new PrismaClient({ datasources: { db: { url } } })
    prismaClientCache.set(id, client)
    return client
}

export async function getBusinessPrismaByCookie() {
    const cookieStore = await cookies()
    const businessId = cookieStore.get(DEFAULT_BUSINESS_COOKIE)?.value
    if (!businessId) throw new Error('No business ID found in cookies')
    return getBusinessPrisma(businessId)
}

export async function disconnectAllBusinessPrisma() {
    const disconnectPromises = Array.from(prismaClientCache.values()).map(client =>
        client.$disconnect().catch(err => console.error('Error disconnecting Prisma client:', err))
    )
    await Promise.all(disconnectPromises)
    prismaClientCache.clear()
}

if (typeof process !== 'undefined') {
    const shutdown = async (signal: string) => {
        console.log(`${signal} received, disconnecting Prisma clients...`)
        await disconnectAllBusinessPrisma()
        process.exit(0)
    }
    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
}

// Backwards-compatible default export for environments using a single business DB from env
// Not used for multi-tenant per-business DBs; prefer getBusinessPrisma(dbName)
const defaultClient = new PrismaClient()
export default defaultClient