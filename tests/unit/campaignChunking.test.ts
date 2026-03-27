// for dissertation section 5.5.4 — asynchronous campaign chunking
//
// enqueueChunkedCampaignJobs is internal to the route, so we mock all i/o deps
// and call the exported POST handler to assert chunkCount from the response
import { describe, it, expect, vi, beforeEach } from "vitest"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { publishCampaignChunk } from "@/lib/qstash"
import { runCampaignJob } from "@/utils/campaign"
import { deleteCampaignFileJob } from "@/utils/files"
import { after } from "next/server"
import { POST } from "@/app/api/jobs/campaign/route"

const mockFindUnique = vi.fn()
const mockRunLogCreate = vi.fn()

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof import("next/server")>()
    return {
        ...actual,
        after: vi.fn(async (callback: () => void | Promise<void>) => {
            await callback()
        }),
    }
})

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

function makeRequestWithPayload(payload: unknown, headers: Record<string, string> = {}) {
    return new Request("http://localhost/api/jobs/campaign", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
        body: JSON.stringify(payload),
    })
}

describe("Campaign chunking — Equation 5.7: N_chunks = ⌈ N_customers / S_chunk ⌉", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        delete process.env.CAMPAIGN_JOB_SECRET
        delete process.env.CAMPAIGN_JOB_CHUNK_SIZE
    })

    it("returns chunkCount = 3 for 501 customers with default chunk size 250", async () => {
        // ⌈501 / 250⌉ = 3
        setupMocksForCustomerCount(501)
        const response = await POST(makeRequest())
        const body = await response.json()

        expect(body.mode).toBe("CHUNK_ORCHESTRATED")
        expect(body.chunkCount).toBe(3)
    })

    it("returns chunkCount = 2 for exactly 500 customers", async () => {
        // ⌈500 / 250⌉ = 2
        setupMocksForCustomerCount(500)
        const response = await POST(makeRequest())
        const body = await response.json()

        expect(body.mode).toBe("CHUNK_ORCHESTRATED")
        expect(body.chunkCount).toBe(2)
    })

    it("returns chunkCount = 2 for 251 customers (boundary above one chunk)", async () => {
        // ⌈251 / 250⌉ = 2
        setupMocksForCustomerCount(251)
        const response = await POST(makeRequest())
        const body = await response.json()

        expect(body.mode).toBe("CHUNK_ORCHESTRATED")
        expect(body.chunkCount).toBe(2)
    })

    it("does NOT orchestrate chunks when customerCount ≤ chunkSize", async () => {
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

describe("Campaign route handler branches", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        delete process.env.CAMPAIGN_JOB_SECRET
        delete process.env.CAMPAIGN_JOB_CHUNK_SIZE
    })

    it("returns 401 when campaign secret is configured but header is missing", async () => {
        process.env.CAMPAIGN_JOB_SECRET = "expected-secret"

        const response = await POST(makeRequest())
        const body = await response.json()

        expect(response.status).toBe(401)
        expect(body.error).toMatch(/unauthorized/i)
    })

    it("accepts request when campaign secret header matches", async () => {
        process.env.CAMPAIGN_JOB_SECRET = "expected-secret"
        setupMocksForCustomerCount(251)

        const response = await POST(
            makeRequestWithPayload(
                {
                    jobType: "RUN_CAMPAIGNS",
                    triggerSource: "MANUAL",
                    campaignId: "campaign-abc",
                    businessIds: ["business-1"],
                },
                { "x-campaign-job-secret": "expected-secret" },
            ),
        )

        expect(response.status).toBe(200)
    })

    it("returns 400 for invalid payload without jobType", async () => {
        const response = await POST(makeRequestWithPayload({}))
        const body = await response.json()

        expect(response.status).toBe(400)
        expect(body.error).toMatch(/invalid job payload/i)
    })

    it("returns DEFAULT_EXECUTION and processed business count for non-orchestrated runs", async () => {
        setupMocksForCustomerCount(250)
        vi.mocked(runCampaignJob).mockResolvedValue([
            { success: true },
            { success: true },
        ] as any)

        const response = await POST(makeRequest())
        const body = await response.json()

        expect(body.mode).toBe("DEFAULT_EXECUTION")
        expect(body.processedBusinesses).toBe(2)
    })

    it("falls back to default chunk size when env chunk size is not a number", async () => {
        process.env.CAMPAIGN_JOB_CHUNK_SIZE = "not-a-number"
        setupMocksForCustomerCount(251)

        const response = await POST(makeRequest())
        const body = await response.json()

        expect(body.mode).toBe("CHUNK_ORCHESTRATED")
        expect(body.chunkSize).toBe(250)
    })

    it("enforces minimum chunk size of 1 when env chunk size is zero", async () => {
        process.env.CAMPAIGN_JOB_CHUNK_SIZE = "0"
        setupMocksForCustomerCount(2)

        const response = await POST(makeRequest())
        const body = await response.json()

        expect(body.mode).toBe("CHUNK_ORCHESTRATED")
        expect(body.chunkSize).toBe(1)
    })

    it("returns CHUNK_EXECUTION_ASYNC and schedules the next chunk when current chunk succeeds", async () => {
        vi.mocked(runCampaignJob).mockResolvedValue([{ success: true }] as any)

        const response = await POST(
            makeRequestWithPayload({
                jobType: "RUN_CAMPAIGNS",
                triggerSource: "MANUAL",
                campaignId: "campaign-abc",
                businessIds: ["business-1"],
                chunked: true,
                jobId: "run-log-1",
                chunkOrder: 0,
                totalChunks: 3,
                chunkOffset: 0,
                chunkLimit: 200,
                isFinalChunk: false,
            }),
        )
        const body = await response.json()

        expect(body.mode).toBe("CHUNK_EXECUTION_ASYNC")
        expect(vi.mocked(after)).toHaveBeenCalledTimes(1)
        expect(vi.mocked(publishCampaignChunk)).toHaveBeenCalledTimes(1)
        expect(vi.mocked(publishCampaignChunk)).toHaveBeenCalledWith(
            "http://localhost",
            expect.objectContaining({
                chunkOrder: 1,
                chunkOffset: 200,
                isFinalChunk: false,
            }),
            expect.any(Object),
        )
    })

    it("does not enqueue a next chunk when chunked execution has failures", async () => {
        vi.mocked(runCampaignJob).mockResolvedValue([{ success: false }] as any)

        const response = await POST(
            makeRequestWithPayload({
                jobType: "RUN_CAMPAIGNS",
                triggerSource: "MANUAL",
                campaignId: "campaign-abc",
                businessIds: ["business-1"],
                chunked: true,
                jobId: "run-log-1",
                chunkOrder: 0,
                totalChunks: 2,
                chunkOffset: 0,
                chunkLimit: 100,
            }),
        )

        expect(response.status).toBe(200)
        expect(vi.mocked(publishCampaignChunk)).not.toHaveBeenCalled()
    })

    it("handles DELETE_EXPIRED_FILES jobs", async () => {
        const response = await POST(
            makeRequestWithPayload({
                jobType: "DELETE_EXPIRED_FILES",
            }),
        )
        const body = await response.json()

        expect(body.ok).toBe(true)
        expect(body.jobType).toBe("DELETE_EXPIRED_FILES")
        expect(vi.mocked(deleteCampaignFileJob)).toHaveBeenCalledTimes(1)
    })

    it("returns 400 for unsupported job type", async () => {
        const response = await POST(
            makeRequestWithPayload({
                jobType: "UNSUPPORTED_JOB",
            }),
        )
        const body = await response.json()

        expect(response.status).toBe(400)
        expect(body.error).toMatch(/unsupported job type/i)
    })

    it("returns 500 when campaign runner throws", async () => {
        setupMocksForCustomerCount(250)
        vi.mocked(runCampaignJob).mockRejectedValue(new Error("worker exploded"))

        const response = await POST(makeRequest())
        const body = await response.json()

        expect(response.status).toBe(500)
        expect(body.error).toMatch(/worker exploded/i)
    })
})

// boundary condition table for Equation 5.7
describe("Equation 5.7 — ⌈ N / S ⌉ boundary conditions", () => {
    const S = 250

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
