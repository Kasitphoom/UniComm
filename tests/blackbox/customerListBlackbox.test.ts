import { beforeEach, describe, expect, it, vi } from "vitest"
import { requireAuth } from "@/lib/api-auth"
import { userHasPermissionAPI } from "@/utils/permissions"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { GET, POST } from "@/app/api/customer-list/route"
import { NextResponse } from "next/server"

const {
    mockContactListCreate,
    mockContactListFindMany,
    mockCustomerCreateMany,
    mockContactListDelete,
} = vi.hoisted(() => ({
    mockContactListCreate: vi.fn(),
    mockContactListFindMany: vi.fn(),
    mockCustomerCreateMany: vi.fn(),
    mockContactListDelete: vi.fn(),
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

vi.mock("@/app/generated/business/prisma", () => ({
    UserRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER" },
}))

function makeCsvUploadRequest(csvContent: string, fileName = "customers.csv") {
    const formData = new FormData()
    formData.set("name", "Leads - April")
    formData.set("remarks", "CSV import")
    formData.set("upsertMode", "true")
    formData.set("file", new File([csvContent], fileName, { type: "text/csv" }))

    return new Request("http://localhost/api/customer-list", {
        method: "POST",
        body: formData,
    })
}

function makeJsonRequest(body: unknown) {
    return new Request("http://localhost/api/customer-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
}

describe("POST /api/customer-list — black-box functional and error validation", () => {
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

        mockContactListCreate.mockResolvedValue({
            id: "list-1",
            name: "Leads - April",
            source: "CSV_UPLOAD",
        })
        mockCustomerCreateMany.mockResolvedValue({ count: 2 })
        mockContactListDelete.mockResolvedValue(undefined)

        vi.mocked(getBusinessPrisma).mockReturnValue({
            contactList: {
                create: mockContactListCreate,
                findMany: mockContactListFindMany,
                delete: mockContactListDelete,
            },
            customer: {
                createMany: mockCustomerCreateMany,
            },
        } as any)

        mockContactListFindMany.mockResolvedValue([])
    })

    it("returns 200 with contactLists for authenticated GET requests", async () => {
        mockContactListFindMany.mockResolvedValueOnce([
            { id: "list-1", name: "Leads", _count: { customers: 2 } },
        ])

        const res = await GET(new Request("http://localhost/api/customer-list") as any)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(Array.isArray(body.contactLists)).toBe(true)
        expect(body.contactLists.length).toBe(1)
    })

    it("returns 401 for customer-list GET when auth fails", async () => {
        vi.mocked(requireAuth).mockResolvedValueOnce({
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        } as any)

        const res = await GET(new Request("http://localhost/api/customer-list") as any)
        expect(res.status).toBe(401)
    })

    it("returns 404 when business prisma client is unavailable on GET", async () => {
        vi.mocked(getBusinessPrisma).mockReturnValueOnce(null as any)

        const res = await GET(new Request("http://localhost/api/customer-list") as any)
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error).toMatch(/business database not found/i)
    })

    it("returns 500 when customer-list GET fails unexpectedly", async () => {
        mockContactListFindMany.mockRejectedValueOnce(new Error("db timeout"))

        const res = await GET(new Request("http://localhost/api/customer-list") as any)
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error).toMatch(/failed to fetch customers/i)
    })

    it("returns 201 and record counts for a valid CSV upload", async () => {
        const req = makeCsvUploadRequest("name,email\nAlice,alice@example.com\nBob,bob@example.com")

        const res = await POST(req as any)
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.recordsCount).toBe(2)
        expect(body.customersCreated).toBe(2)
        expect(body.contactList.name).toBe("Leads - April")
    })

    it("returns 400 when CSV content is malformed", async () => {
        const malformed = 'name,email\n"Alice,alice@example.com'
        const req = makeCsvUploadRequest(malformed)

        const res = await POST(req as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toMatch(/invalid csv format/i)
    })

    it("returns 400 when upload file extension is not .csv", async () => {
        const req = makeCsvUploadRequest("name,email\nAlice,alice@example.com", "customers.txt")

        const res = await POST(req as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toMatch(/only csv files are allowed/i)
    })

    it("returns 400 when CSV file has no data rows", async () => {
        const req = makeCsvUploadRequest("name,email\n")

        const res = await POST(req as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toMatch(/csv file is empty/i)
    })

    it("returns 400 when multipart upload is missing file", async () => {
        const formData = new FormData()
        formData.set("name", "Leads - April")

        const req = new Request("http://localhost/api/customer-list", {
            method: "POST",
            body: formData,
        })

        const res = await POST(req as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toMatch(/csv file is required/i)
    })

    it("returns 400 when multipart upload is missing name", async () => {
        const formData = new FormData()
        formData.set("file", new File(["name,email\nAlice,alice@example.com"], "customers.csv", { type: "text/csv" }))

        const req = new Request("http://localhost/api/customer-list", {
            method: "POST",
            body: formData,
        })

        const res = await POST(req as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toMatch(/name is required/i)
    })

    it("returns 403 when user lacks permission to create customer lists", async () => {
        vi.mocked(userHasPermissionAPI).mockResolvedValue(false)

        const req = makeCsvUploadRequest("name,email\nAlice,alice@example.com")
        const res = await POST(req as any)

        expect(res.status).toBe(403)
    })

    it("returns 400 when manual JSON payload has invalid source", async () => {
        const req = makeJsonRequest({
            name: "Manual Contacts",
            source: "SPREADSHEET",
            fields: [{ name: "email", type: "email" }],
        })

        const res = await POST(req as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toMatch(/invalid source/i)
    })

    it("returns 400 when manual JSON payload has no fields", async () => {
        const req = makeJsonRequest({
            name: "Manual Contacts",
            source: "MANUAL",
            fields: [],
        })

        const res = await POST(req as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toMatch(/at least one field is required/i)
    })

    it("returns 201 for valid manual JSON payload", async () => {
        mockContactListCreate.mockResolvedValueOnce({
            id: "list-manual-1",
            name: "Manual Contacts",
            source: "MANUAL",
        })

        const req = makeJsonRequest({
            name: "Manual Contacts",
            source: "MANUAL",
            remarks: "manual import",
            upsertMode: false,
            fields: [
                { name: "email", type: "email" },
                { name: "first_name", type: "string" },
            ],
        })

        const res = await POST(req as any)
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.contactList.id).toBe("list-manual-1")
        expect(body.contactList.source).toBe("MANUAL")
    })

    it("returns 409 when contact list name already exists", async () => {
        mockContactListCreate.mockRejectedValueOnce({ code: "P2002" })

        const req = makeJsonRequest({
            name: "Leads - April",
            source: "MANUAL",
            fields: [{ name: "email", type: "email" }],
        })

        const res = await POST(req as any)
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error).toMatch(/already exists/i)
    })
})
