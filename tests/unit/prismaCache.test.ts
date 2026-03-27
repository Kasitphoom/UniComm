/**
 * Section 5.2.2 — Multi-Tenant Connection Caching
 *
 * White-box tests for `getBusinessPrisma`, which uses a module-level
 * `Map<string, PrismaClient>` to cache database connections.
 *
 * Assertions:
 *   1. Cache miss  — a new PrismaClient is constructed on the first call.
 *   2. Cache hit   — the exact same object reference is returned on subsequent
 *                    calls with the same businessId, proving no new connection
 *                    is opened.
 *   3. Isolation   — different businessIds produce different client instances.
 *   4. Cache clear — `disconnectAllBusinessPrisma` drains the cache so the
 *                    next call creates a fresh client.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mock the generated Prisma client.
// Must use a regular `function` (not an arrow function) so it is constructable
// via `new PrismaClient(...)`.
// ---------------------------------------------------------------------------

vi.mock("@/app/generated/business/prisma", () => {
    const PrismaClient = vi.fn(function(this: any) {
        this.$disconnect = vi.fn().mockResolvedValue(undefined)
    })
    return { PrismaClient }
})

vi.mock("next/headers", () => ({
    cookies: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks are registered
// ---------------------------------------------------------------------------

import { PrismaClient } from "@/app/generated/business/prisma"
import {
    getBusinessPrisma,
    disconnectAllBusinessPrisma,
    buildBusinessDbUrl,
} from "@/lib/prisma-business"

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
    // Clear the in-memory cache and reset all constructor call tracking.
    await disconnectAllBusinessPrisma()
    vi.mocked(PrismaClient).mockClear()
    process.env.BUSINESS_DATABASE_URL = "mongodb://localhost:27017/admin"
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getBusinessPrisma — cache miss (first call)", () => {
    it("constructs a new PrismaClient on the first call for a given businessId", () => {
        getBusinessPrisma("tenant-a")

        expect(PrismaClient).toHaveBeenCalledTimes(1)
    })

    it("passes a datasource URL containing the businessId to the constructor", () => {
        getBusinessPrisma("tenant-x")

        const constructorArgs = vi.mocked(PrismaClient).mock.calls[0][0] as any
        expect(constructorArgs.datasources.db.url).toContain("business_tenant-x")
    })
})

describe("getBusinessPrisma — cache hit (second call)", () => {
    it("returns the exact same object reference on every subsequent call", () => {
        const first = getBusinessPrisma("tenant-b")
        const second = getBusinessPrisma("tenant-b")

        // Reference equality proves the cache was hit — no new connection
        expect(first).toBe(second)
    })

    it("does NOT construct a new PrismaClient on a cache hit", () => {
        getBusinessPrisma("tenant-b")
        getBusinessPrisma("tenant-b")
        getBusinessPrisma("tenant-b")

        // Three calls → only one PrismaClient instantiation
        expect(PrismaClient).toHaveBeenCalledTimes(1)
    })
})

describe("getBusinessPrisma — tenant isolation", () => {
    it("creates distinct instances for different businessIds", () => {
        const clientA = getBusinessPrisma("tenant-c")
        const clientB = getBusinessPrisma("tenant-d")

        expect(clientA).not.toBe(clientB)
    })

    it("constructs exactly one client per unique businessId", () => {
        getBusinessPrisma("tenant-e")
        getBusinessPrisma("tenant-e")  // cache hit — no new instance
        getBusinessPrisma("tenant-f")
        getBusinessPrisma("tenant-f")  // cache hit — no new instance

        expect(PrismaClient).toHaveBeenCalledTimes(2)
    })
})

describe("disconnectAllBusinessPrisma — cache eviction", () => {
    it("forces a new client to be created after the cache is cleared", async () => {
        const before = getBusinessPrisma("tenant-g")

        await disconnectAllBusinessPrisma()

        const after = getBusinessPrisma("tenant-g")

        expect(before).not.toBe(after)
        expect(PrismaClient).toHaveBeenCalledTimes(2)
    })

    it("calls $disconnect on every cached client", async () => {
        const client1 = getBusinessPrisma("tenant-h")
        const client2 = getBusinessPrisma("tenant-i")

        await disconnectAllBusinessPrisma()

        expect(client1.$disconnect).toHaveBeenCalledTimes(1)
        expect(client2.$disconnect).toHaveBeenCalledTimes(1)
    })
})

describe("buildBusinessDbUrl", () => {
    it("incorporates the businessId as the database name", () => {
        const url = buildBusinessDbUrl("acme-corp")
        expect(url).toContain("business_acme-corp")
    })

    it("throws when BUSINESS_DATABASE_URL is not configured", () => {
        delete process.env.BUSINESS_DATABASE_URL
        expect(() => buildBusinessDbUrl("any")).toThrow("BUSINESS_DATABASE_URL is not set")
    })
})
