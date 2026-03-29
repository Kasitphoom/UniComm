import { beforeEach, describe, expect, it, vi } from "vitest"
import { requireAuth } from "@/lib/api-auth"
import { userHasPermissionAPI } from "@/utils/permissions"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { getStorageService } from "@/utils/upload/modules"
import { GET, POST } from "@/app/api/templates/route"
import { NextResponse } from "next/server"

const {
    mockTemplatesFindMany,
    mockTemplatesCount,
    mockTemplatesFindUnique,
    mockTemplatesCreate,
    mockBusinessUserFindUnique,
    mockUploadFile,
    mockReadFile,
} = vi.hoisted(() => ({
    mockTemplatesFindMany: vi.fn(),
    mockTemplatesCount: vi.fn(),
    mockTemplatesFindUnique: vi.fn(),
    mockTemplatesCreate: vi.fn(),
    mockBusinessUserFindUnique: vi.fn(),
    mockUploadFile: vi.fn(),
    mockReadFile: vi.fn(),
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

vi.mock("@/utils/upload/modules", () => ({
    getStorageService: vi.fn(),
}))

vi.mock("node:fs/promises", () => ({
    readFile: mockReadFile,
    default: {
        readFile: mockReadFile,
    },
}))

vi.mock("@/utils/sanitizer", () => ({
    sanitizeQuery: (q: unknown) => q,
}))

vi.mock("@/app/generated/business/prisma", () => ({
    UserRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER" },
    Prisma: {},
}))

function makeJsonRequest(body: unknown) {
    return new Request("http://localhost/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
}

describe("/api/templates — black-box functional and isolation validation", () => {
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
            templates: {
                findMany: mockTemplatesFindMany,
                count: mockTemplatesCount,
                findUnique: mockTemplatesFindUnique,
                create: mockTemplatesCreate,
            },
            businessUser: {
                findUnique: mockBusinessUserFindUnique,
            },
        } as any)

        vi.mocked(getStorageService).mockReturnValue({
            uploadFile: mockUploadFile,
        } as any)

        mockReadFile.mockResolvedValue(
            '<?xml version="1.0"?><Document width="REPLACE_WIDTH" height="REPLACE_HEIGHT"><Page /></Document>',
        )

        mockUploadFile.mockResolvedValue("https://files.example.com/business-a/templates/welcome.xml")
        mockTemplatesFindMany.mockResolvedValue([])
        mockTemplatesCount.mockResolvedValue(0)
        mockTemplatesFindUnique.mockResolvedValue(null)
        mockBusinessUserFindUnique.mockResolvedValue({ id: "user-1", role: "OWNER" })
        mockTemplatesCreate.mockResolvedValue({
            id: "template-1",
            title: "Welcome Template",
            filePath: "https://files.example.com/business-a/templates/welcome.xml",
            userId: "user-1",
            versions: [],
            approvers: [],
            user: { id: "user-1" },
        })
    })

    it("returns 200 with paginated templates for authenticated GET requests", async () => {
        mockTemplatesFindMany.mockResolvedValueOnce([
            {
                id: "template-1",
                title: "Welcome Template",
                userId: "user-2",
                approvers: [{ userId: "user-1", user: { id: "user-1" } }],
                versions: [],
                contactList: null,
                user: { id: "user-2" },
            },
        ])
        mockTemplatesCount.mockResolvedValueOnce(1)

        const res = await GET(
            new Request("http://localhost/api/templates?query=welcome&page=1&perPage=8&userOnly=true") as any,
        )
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(Array.isArray(body.templates)).toBe(true)
        expect(body.templates.length).toBe(1)
        expect(body.templates[0].requireUserApproval).toBe(true)
        expect(body.currentPage).toBe(1)
        expect(body.total).toBe(1)
    })

    it("returns 401 for templates GET when auth fails", async () => {
        vi.mocked(requireAuth).mockResolvedValueOnce({
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        } as any)

        const res = await GET(new Request("http://localhost/api/templates") as any)
        expect(res.status).toBe(401)
    })

    it("normalizes pagination bounds for templates GET", async () => {
        const res = await GET(new Request("http://localhost/api/templates?page=0&perPage=999") as any)

        expect(res.status).toBe(200)
        expect(mockTemplatesFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 50,
                skip: 0,
            }),
        )
    })

    it("returns 500 when templates GET fails unexpectedly", async () => {
        mockTemplatesFindMany.mockRejectedValueOnce(new Error("db timeout"))

        const res = await GET(new Request("http://localhost/api/templates") as any)
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error).toMatch(/db timeout|failed to fetch templates/i)
    })

    it("uses only the authenticated tenant context when listing templates", async () => {
        await GET(new Request("http://localhost/api/templates") as any)

        expect(getBusinessPrisma).toHaveBeenCalledWith("business-a")
        expect(getBusinessPrisma).not.toHaveBeenCalledWith("business-b")
    })

    it("returns 201 for a valid create-template payload", async () => {
        const req = makeJsonRequest({
            templateName: "Welcome Template",
            orientation: "portrait",
            widthCm: 21,
            heightCm: 29.7,
            customerListId: "list-1",
        })

        const res = await POST(req as any)
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.id).toBe("template-1")
        expect(body.title).toBe("Welcome Template")
        expect(mockUploadFile).toHaveBeenCalledTimes(1)
    })

    it("returns 403 when user lacks permission to create templates", async () => {
        vi.mocked(userHasPermissionAPI).mockResolvedValueOnce(false)

        const req = makeJsonRequest({
            templateName: "Welcome Template",
            orientation: "portrait",
            widthCm: 21,
            heightCm: 29.7,
        })

        const res = await POST(req as any)
        expect(res.status).toBe(403)
    })

    it("returns 400 when create-template payload is missing required fields", async () => {
        const req = makeJsonRequest({
            templateName: "Welcome Template",
            orientation: "portrait",
        })

        const res = await POST(req as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toMatch(/missing any of the following/i)
    })

    it("returns 400 when template name already exists", async () => {
        mockTemplatesFindUnique.mockResolvedValueOnce({
            id: "template-existing",
            title: "Welcome Template",
        })

        const req = makeJsonRequest({
            templateName: "Welcome Template",
            orientation: "portrait",
            widthCm: 21,
            heightCm: 29.7,
        })

        const res = await POST(req as any)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toMatch(/already exists/i)
    })

    it("returns 404 when business user record is missing during create-template", async () => {
        mockBusinessUserFindUnique.mockResolvedValueOnce(null)

        const req = makeJsonRequest({
            templateName: "Welcome Template",
            orientation: "portrait",
            widthCm: 21,
            heightCm: 29.7,
        })

        const res = await POST(req as any)
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error).toMatch(/business user not found/i)
    })

    it("returns 500 when storage service is not configured", async () => {
        vi.mocked(getStorageService).mockReturnValueOnce(null as any)

        const req = makeJsonRequest({
            templateName: "Welcome Template",
            orientation: "portrait",
            widthCm: 21,
            heightCm: 29.7,
        })

        const res = await POST(req as any)
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error).toMatch(/storage service not configured/i)
    })

    it("returns 401 when auth context has no user id during create-template", async () => {
        vi.mocked(requireAuth).mockResolvedValueOnce({
            ok: true,
            businessId: "business-a",
            userId: null,
            mainUserId: null,
        } as any)

        const req = makeJsonRequest({
            templateName: "Welcome Template",
            orientation: "portrait",
            widthCm: 21,
            heightCm: 29.7,
        })

        const res = await POST(req as any)
        expect(res.status).toBe(401)
    })
})
