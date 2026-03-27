/**
 * Section 5.5.4 — Asynchronous Campaign Chunking (Equation 5.7)
 *
 * White-box tests for the chunk boundary calculation:
 *
 *   N_chunks = ⌈ N_customers / S_chunk ⌉
 *
 * The production function `enqueueChunkedCampaignJobs` (internal to the route)
 * computes this at line 64:
 *
 *   const chunkCount = Math.ceil(customerCount / chunkSize)
 *
 * Strategy: mock all I/O dependencies (Prisma, QStash) and invoke the exported
 * POST handler with a RUN_CAMPAIGNS payload. The handler's JSON response
 * includes `chunkCount`, letting us assert the math directly against real code.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { publishCampaignChunk } from "@/lib/qstash"
import { POST } from "@/app/api/jobs/campaign/route"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindUnique = vi.fn()
const mockRunLogCreate = vi.fn()

vi.mock("@/lib/prisma-business", () => ({
    getBusinessPrisma: vi.fn(),
}))

vi.mock("@/lib/qstash", () => ({
    publishCampaignChunk: vi.fn(),
}))

vi.mock("@/utils/campaign", () => ({
    runCampaignJob: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/utils/files", () => ({
    deleteCampaignFileJob: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/app/generated/business/prisma", () => ({
    PrismaClient: vi.fn(function(this: any) {}),
    FILE_STATUS: { PENDING: "PENDING", DONE: "DONE" },
    SCHEDULE_STATUS: { RUNNING: "RUNNING", DONE: "DONE" },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupMocksForCustomerCount(customerCount: number) {
    mockFindUnique.mockResolvedValue({
        id: "campaign-abc",
        name: "Test Campaign",
        contactlist: {
            customers: Array.from({ length: customerCount }, (_, i) => ({ id: `c-${i}` })),
        },
    })
    mockRunLogCreate.mockResolvedValue({ id: "run-log-1" })

    vi.mocked(getBusinessPrisma).mockReturnValue({
        campaign: { findUnique: mockFindUnique },
        campaignRunLog: { create: mockRunLogCreate },
    } as any)

    vi.mocked(publishCampaignChunk).mockResolvedValue({ messageId: "msg-test-1" } as any)
}

function makeRequest() {
    return new Request("http://localhost/api/jobs/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jobType: "RUN_CAMPAIGNS",
            triggerSource: "MANUAL",
            campaignId: "campaign-abc",
            businessIds: ["business-1"],
        }),
    })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Campaign chunking — Equation 5.7: N_chunks = ⌈ N_customers / S_chunk ⌉", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("returns chunkCount = 3 for 501 customers with default chunk size 250", async () => {
        // ⌈501 / 250⌉ = ⌈2.004⌉ = 3
        setupMocksForCustomerCount(501)
        const response = await POST(makeRequest())
        const body = await response.json()

        expect(body.mode).toBe("CHUNK_ORCHESTRATED")
        expect(body.chunkCount).toBe(3)
    })

    it("returns chunkCount = 2 for exactly 500 customers", async () => {
        // ⌈500 / 250⌉ = ⌈2.0⌉ = 2
        setupMocksForCustomerCount(500)
        const response = await POST(makeRequest())
        const body = await response.json()

        expect(body.mode).toBe("CHUNK_ORCHESTRATED")
        expect(body.chunkCount).toBe(2)
    })

    it("returns chunkCount = 2 for 251 customers (boundary above one chunk)", async () => {
        // ⌈251 / 250⌉ = ⌈1.004⌉ = 2
        setupMocksForCustomerCount(251)
        const response = await POST(makeRequest())
        const body = await response.json()

        expect(body.mode).toBe("CHUNK_ORCHESTRATED")
        expect(body.chunkCount).toBe(2)
    })

    it("does NOT orchestrate chunks when customerCount ≤ chunkSize (falls through to default execution)", async () => {
        // 250 customers with chunk size 250 → orchestration short-circuits
        setupMocksForCustomerCount(250)
        const response = await POST(makeRequest())
        const body = await response.json()

        expect(body.mode).not.toBe("CHUNK_ORCHESTRATED")
    })

    it("echoes customerCount and chunkSize back in the orchestration response", async () => {
        setupMocksForCustomerCount(501)
        const response = await POST(makeRequest())
        const body = await response.json()

        expect(body.customerCount).toBe(501)
        expect(body.chunkSize).toBe(250)
    })

    it("publishes exactly one QStash message for the first chunk", async () => {
        setupMocksForCustomerCount(501)
        await POST(makeRequest())

        expect(vi.mocked(publishCampaignChunk)).toHaveBeenCalledTimes(1)
    })
})

// ---------------------------------------------------------------------------
// Pure formula verification (Equation 5.7 boundary conditions)
// ---------------------------------------------------------------------------

describe("Equation 5.7 — ⌈ N / S ⌉ boundary conditions", () => {
    const S = 250  // default chunk size

    it.each([
        [1,    S, 1],
        [250,  S, 1],
        [251,  S, 2],
        [500,  S, 2],
        [501,  S, 3],
        [750,  S, 3],
        [751,  S, 4],
        [1000, S, 4],
        [1001, S, 5],
    ])("⌈%i / %i⌉ = %i", (customers, chunkSize, expected) => {
        expect(Math.ceil(customers / chunkSize)).toBe(expected)
    })
})
