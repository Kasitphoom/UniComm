import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { userHasPermissionAPI } from "@/utils/permissions"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { refreshTemplateDependencies } from "@/utils/template/refreshTemplateDependencies"
import { enqueueCampaignWorkerJob } from "@/lib/external-job-queue"
import { GET as listCampaignsGET, POST as createCampaignPOST } from "@/app/api/campaigns/route"
import { GET as runCampaignGET, POST as runCampaignPOST } from "@/app/api/campaigns/[id]/run/route"

const {
    mockCampaignFindUnique,
    mockCampaignFindMany,
    mockCampaignCount,
    mockCampaignCreate,
    mockCampaignUpdate,
    mockContactListFindUnique,
} = vi.hoisted(() => ({
    mockCampaignFindUnique: vi.fn(),
    mockCampaignFindMany: vi.fn(),
    mockCampaignCount: vi.fn(),
    mockCampaignCreate: vi.fn(),
    mockCampaignUpdate: vi.fn(),
    mockContactListFindUnique: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
    requireAuth: vi.fn(),
}))

vi.mock("@/utils/permissions", () => ({
    userHasPermissionAPI: vi.fn(),
}))

vi.mock("@/lib/prisma-business", () => ({
    getBusinessPrisma: vi.fn(),
}))

vi.mock("@/utils/template/refreshTemplateDependencies", () => ({
    refreshTemplateDependencies: vi.fn(),
}))

vi.mock("@/lib/external-job-queue", () => ({
    enqueueCampaignWorkerJob: vi.fn(),
}))

vi.mock("@/utils/sanitizer", () => ({
    sanitizeQuery: (q: unknown) => q,
}))

vi.mock("@/app/generated/business/prisma", () => ({
    UserRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER" },
    FILE_STATUS: { PENDING: "PENDING", READY: "READY", FAILED: "FAILED" },
    SCHEDULE_STATUS: { PENDING: "PENDING", RUNNING: "RUNNING", DONE: "DONE", FAILED: "FAILED" },
    Prisma: {},
}))

function makeJsonRequest(url: string, body: unknown) {
    return new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
}

describe("Campaign black-box workflow validation", () => {
    beforeEach(() => {
        vi.clearAllMocks()

        vi.mocked(requireAuth).mockResolvedValue({
            ok: true,
            businessId: "business-a",
            userId: "user-1",
            mainUserId: "user-1",
            session: null,
            token: null,
        } as any)

        vi.mocked(userHasPermissionAPI).mockResolvedValue(true)

        vi.mocked(getBusinessPrisma).mockReturnValue({
            campaign: {
                findUnique: mockCampaignFindUnique,
                findMany: mockCampaignFindMany,
                count: mockCampaignCount,
                create: mockCampaignCreate,
                update: mockCampaignUpdate,
            },
            contactList: {
                findUnique: mockContactListFindUnique,
            },
        } as any)

        vi.mocked(enqueueCampaignWorkerJob).mockResolvedValue({ messageId: "trigger-123" } as any)
        mockCampaignFindMany.mockResolvedValue([])
        mockCampaignCount.mockResolvedValue(0)
    })

    it("returns paginated campaign list for filtered query parameters", async () => {
        mockCampaignFindMany.mockResolvedValueOnce([
            { id: "campaign-1", name: "April Run", templates: [], logs: [] },
        ])
        mockCampaignCount.mockResolvedValueOnce(1)

        const req = new Request(
            "http://localhost/api/campaigns?query=April&page=1&perPage=5&fileStatus=PENDING&scheduleStatus=RUNNING&range=LAST_7_DAYS",
            { method: "GET" },
        )

        const res = await listCampaignsGET(req as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.totalCount).toBe(1)
        expect(body.currentPage).toBe(1)
        expect(body.totalPages).toBe(1)
        expect(Array.isArray(body.campaigns)).toBe(true)
    })

    it("returns 400 when selected template requires fields missing from customer list", async () => {
        mockCampaignFindUnique.mockResolvedValueOnce(null)
        mockContactListFindUnique.mockResolvedValueOnce({
            id: "list-1",
            fields: [{ field: "first_name", type: "string" }],
            _count: { customers: 2 },
        })
        vi.mocked(refreshTemplateDependencies).mockResolvedValue({
            id: "template-1",
            title: "Offer Template",
            requiredFields: ["email"],
        } as any)

        const req = makeJsonRequest("http://localhost/api/campaigns", {
            name: "April Run",
            scheduledAt: new Date().toISOString(),
            templateIds: ["template-1"],
            customerListId: "list-1",
        })

        const res = await createCampaignPOST(req as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toMatch(/missing required fields/i)
        expect(body.missingFields).toEqual(["email"])
    })

    it("returns 201 for a valid create-campaign payload", async () => {
        mockCampaignFindUnique.mockResolvedValueOnce(null)
        mockContactListFindUnique.mockResolvedValueOnce({
            id: "list-1",
            fields: [{ field: "email", type: "email" }],
            _count: { customers: 3 },
        })
        vi.mocked(refreshTemplateDependencies).mockResolvedValue({
            id: "template-1",
            title: "Offer Template",
            requiredFields: ["email"],
        } as any)
        mockCampaignCreate.mockResolvedValueOnce({
            id: "campaign-1",
            name: "April Run",
            templates: [],
            logs: [],
        })

        const req = makeJsonRequest("http://localhost/api/campaigns", {
            name: "April Run",
            scheduledAt: new Date().toISOString(),
            templateIds: ["template-1"],
            customerListId: "list-1",
        })

        const res = await createCampaignPOST(req as any)
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.id).toBe("campaign-1")
        expect(body.name).toBe("April Run")
    })

    it("returns 400 when scheduledAt is invalid", async () => {
        const req = makeJsonRequest("http://localhost/api/campaigns", {
            name: "April Run",
            scheduledAt: "not-a-date",
            templateIds: ["template-1"],
            customerListId: "list-1",
        })

        const res = await createCampaignPOST(req as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toMatch(/valid scheduledAt/i)
    })

    it("returns 400 when multiple templates are supplied", async () => {
        const req = makeJsonRequest("http://localhost/api/campaigns", {
            name: "April Run",
            scheduledAt: new Date().toISOString(),
            templateIds: ["template-1", "template-2"],
            customerListId: "list-1",
        })

        const res = await createCampaignPOST(req as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toMatch(/only one template/i)
    })

    it("returns 409 when campaign name already exists", async () => {
        mockCampaignFindUnique.mockResolvedValueOnce({
            id: "campaign-existing",
            name: "April Run",
        })

        const req = makeJsonRequest("http://localhost/api/campaigns", {
            name: "April Run",
            scheduledAt: new Date().toISOString(),
            templateIds: ["template-1"],
            customerListId: "list-1",
        })

        const res = await createCampaignPOST(req as any)
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error).toMatch(/already exists/i)
    })

    it("returns 404 when selected customer list is not found", async () => {
        mockCampaignFindUnique.mockResolvedValueOnce(null)
        mockContactListFindUnique.mockResolvedValueOnce(null)

        const req = makeJsonRequest("http://localhost/api/campaigns", {
            name: "April Run",
            scheduledAt: new Date().toISOString(),
            templateIds: ["template-1"],
            customerListId: "list-missing",
        })

        const res = await createCampaignPOST(req as any)
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error).toMatch(/customer list not found/i)
    })

    it("returns 404 when selected template is missing", async () => {
        mockCampaignFindUnique.mockResolvedValueOnce(null)
        mockContactListFindUnique.mockResolvedValueOnce({
            id: "list-1",
            fields: [{ field: "email", type: "email" }],
            _count: { customers: 2 },
        })
        vi.mocked(refreshTemplateDependencies).mockResolvedValueOnce(null)

        const req = makeJsonRequest("http://localhost/api/campaigns", {
            name: "April Run",
            scheduledAt: new Date().toISOString(),
            templateIds: ["template-missing"],
            customerListId: "list-1",
        })

        const res = await createCampaignPOST(req as any)
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error).toMatch(/template was not found/i)
    })

    it("returns 404 when manually running a campaign that does not exist", async () => {
        mockCampaignFindUnique.mockResolvedValueOnce(null)

        const req = new NextRequest("http://localhost/api/campaigns/campaign-404/run", {
            method: "POST",
        })

        const res = await runCampaignPOST(req as any, {
            params: Promise.resolve({ id: "campaign-404" }),
        })
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error).toMatch(/campaign not found/i)
    })

    it("returns accepted response for happy-path campaign run trigger", async () => {
        mockCampaignFindUnique.mockResolvedValueOnce({
            id: "campaign-1",
            name: "April Run",
            templates: [],
            logs: [],
            files: [],
        })
        mockCampaignUpdate.mockResolvedValueOnce({ id: "campaign-1" })

        const req = new NextRequest("http://localhost/api/campaigns/campaign-1/run", {
            method: "POST",
        })

        const res = await runCampaignPOST(req as any, {
            params: Promise.resolve({ id: "campaign-1" }),
        })
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.accepted).toBe(true)
        expect(body.status).toBe("RUNNING")
        expect(body.triggerId).toBe("trigger-123")
    })

    it("returns 403 when caller lacks permission to run campaign", async () => {
        vi.mocked(userHasPermissionAPI).mockResolvedValue(false)

        const req = new NextRequest("http://localhost/api/campaigns/campaign-1/run", {
            method: "POST",
        })

        const res = await runCampaignPOST(req as any, {
            params: Promise.resolve({ id: "campaign-1" }),
        })

        expect(res.status).toBe(403)
    })

    it("returns 500 when queue trigger fails after campaign status update", async () => {
        mockCampaignFindUnique.mockResolvedValueOnce({
            id: "campaign-1",
            name: "April Run",
            templates: [],
            logs: [],
            files: [],
        })
        mockCampaignUpdate.mockResolvedValueOnce({ id: "campaign-1" })
        vi.mocked(enqueueCampaignWorkerJob).mockRejectedValueOnce(new Error("queue unavailable"))

        const req = new NextRequest("http://localhost/api/campaigns/campaign-1/run", {
            method: "POST",
        })

        const res = await runCampaignPOST(req as any, {
            params: Promise.resolve({ id: "campaign-1" }),
        })
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error).toMatch(/queue unavailable/i)
    })

    it("run status endpoint reports RUNNING when pending campaign has manual trigger log", async () => {
        mockCampaignFindUnique.mockResolvedValueOnce({
            id: "campaign-1",
            scheduleStatus: "PENDING",
            logs: [{ message: "[MANUAL] Campaign run triggered" }],
            templates: [],
            files: [],
        })

        const req = new NextRequest("http://localhost/api/campaigns/campaign-1/run", {
            method: "GET",
        })

        const res = await runCampaignGET(req as any, {
            params: Promise.resolve({ id: "campaign-1" }),
        })
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.isRunning).toBe(true)
        expect(body.status).toBe("RUNNING")
    })

    it("run status endpoint reports campaign status when not queued/running", async () => {
        mockCampaignFindUnique.mockResolvedValueOnce({
            id: "campaign-1",
            scheduleStatus: "DONE",
            logs: [{ message: "completed" }],
            templates: [],
            files: [],
        })

        const req = new NextRequest("http://localhost/api/campaigns/campaign-1/run", {
            method: "GET",
        })

        const res = await runCampaignGET(req as any, {
            params: Promise.resolve({ id: "campaign-1" }),
        })
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.isRunning).toBe(false)
        expect(body.status).toBe("DONE")
    })
})
