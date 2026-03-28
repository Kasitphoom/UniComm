// for dissertation section 5.2.2 — multi-tenant connection caching
import { describe, it, expect, vi, beforeEach } from "vitest"

// must use regular function (not arrow) so it constructable via new PrismaClient(...)
vi.mock("@/app/generated/business/prisma", () => {
    const PrismaClient = vi.fn(function(this: any) {
        this.$disconnect = vi.fn().mockResolvedValue(undefined)
    })
    return { PrismaClient }
})

vi.mock("next/headers", () => ({
    cookies: vi.fn(),
}))

import { PrismaClient } from "@/app/generated/business/prisma"
import { cookies } from "next/headers"
import {
    getBusinessPrisma,
    getBusinessPrismaByCookie,
    disconnectAllBusinessPrisma,
    buildBusinessDbUrl,
} from "@/lib/prisma-business"

beforeEach(async () => {
    await disconnectAllBusinessPrisma()
    vi.mocked(PrismaClient).mockClear()
    process.env.BUSINESS_DATABASE_URL = "mongodb://localhost:27017/admin"
})

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

        // reference equality proves no new connection was opened
        expect(first).toBe(second)
    })

    it("does NOT construct a new PrismaClient on a cache hit", () => {
        getBusinessPrisma("tenant-b")
        getBusinessPrisma("tenant-b")
        getBusinessPrisma("tenant-b")

        // three calls → only one instantiation
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
        getBusinessPrisma("tenant-e") // cache hit
        getBusinessPrisma("tenant-f")
        getBusinessPrisma("tenant-f") // cache hit

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

describe("getBusinessPrismaByCookie", () => {
    it("resolves to the tenant-specific cached prisma client from cookie", async () => {
        vi.mocked(cookies).mockResolvedValue({
            get: vi.fn().mockReturnValue({ value: "tenant-z" }),
        } as any)

        const fromCookie = await getBusinessPrismaByCookie()
        const direct = getBusinessPrisma("tenant-z")

        expect(fromCookie).toBe(direct)
    })

    it("throws when business cookie is missing", async () => {
        vi.mocked(cookies).mockResolvedValue({
            get: vi.fn().mockReturnValue(undefined),
        } as any)

        await expect(getBusinessPrismaByCookie()).rejects.toThrow("No business ID found in cookies")
    })
})

describe("disconnectAllBusinessPrisma error handling", () => {
    it("logs errors from failed disconnects and still clears cache", async () => {
        const client = getBusinessPrisma("tenant-error")
        ;(client.$disconnect as any).mockRejectedValueOnce(new Error("disconnect failed"))
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)

        await disconnectAllBusinessPrisma()

        expect(errorSpy).toHaveBeenCalled()
        const replacement = getBusinessPrisma("tenant-error")
        expect(replacement).not.toBe(client)

        errorSpy.mockRestore()
    })
})
