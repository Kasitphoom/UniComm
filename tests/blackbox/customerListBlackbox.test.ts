import { beforeEach, describe, expect, it, vi } from "vitest"
import { requireAuth } from "@/lib/api-auth"
import { userHasPermissionAPI } from "@/utils/permissions"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { POST } from "@/app/api/customer-list/route"

const {
    mockContactListCreate,
    mockCustomerCreateMany,
    mockContactListDelete,
} = vi.hoisted(() => ({
    mockContactListCreate: vi.fn(),
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
                delete: mockContactListDelete,
            },
            customer: {
                createMany: mockCustomerCreateMany,
            },
        } as any)
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

    it("returns 403 when user lacks permission to create customer lists", async () => {
        vi.mocked(userHasPermissionAPI).mockResolvedValue(false)

        const req = makeCsvUploadRequest("name,email\nAlice,alice@example.com")
        const res = await POST(req as any)

        expect(res.status).toBe(403)
    })
})
