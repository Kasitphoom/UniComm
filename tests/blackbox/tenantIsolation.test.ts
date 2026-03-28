// for dissertation section — black-box security testing (database-per-tenant silo model)
//
// scenario: a user belonging to business-a attempts to access business-b data
// by forging the active business cookie. the system must reject the attempt
// and never open a connection to business-b's database on their behalf.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "@/app/api/business/active/route"
import { GET } from "@/app/api/business/users/route"
import { getServerSession } from "next-auth"
import { getToken } from "next-auth/jwt"
import { getBusinessPrisma } from "@/lib/prisma-business"

// ---------------------------------------------------------------------------
// vi.hoisted ensures these fns exist before the hoisted vi.mock factories run
// ---------------------------------------------------------------------------

const { mockMembershipFindFirst, mockFindMany, mockCount } = vi.hoisted(() => ({
    mockMembershipFindFirst: vi.fn(),
    mockFindMany: vi.fn(),
    mockCount: vi.fn(),
}))

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }))
vi.mock("next/headers", () => ({
    cookies: vi.fn().mockResolvedValue({ get: () => undefined }),
}))
vi.mock("@/lib/auth", () => ({ default: {}, authOptions: {} }))
vi.mock("@/utils/sanitizer", () => ({ sanitizeQuery: (q: unknown) => q }))
vi.mock("@/app/generated/business/prisma", () => ({
    UserRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER" },
}))

// main db — used by /api/business/active to verify membership before setting cookie
vi.mock("@/lib/prisma-main", () => ({
    default: {
        usersOnBusinesses: { findFirst: mockMembershipFindFirst },
    },
}))

// business db — used by /api/business/users to fetch tenant-scoped users
vi.mock("@/lib/prisma-business", () => ({
    getBusinessPrisma: vi.fn().mockReturnValue({
        businessUser: { findMany: mockFindMany, count: mockCount },
    }),
}))

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// simulates a user who is authenticated and belongs only to business-a
function asBusinessAUser() {
    vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "user-1" },
    } as any)
    vi.mocked(getToken).mockResolvedValue({
        id: "user-1",
        activeBusinessId: "business-a",
    } as any)
}

function makePostRequest(body: object) {
    return new Request("http://localhost/api/business/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
}

// ---------------------------------------------------------------------------
// cross-tenant access attempt via /api/business/active
// ---------------------------------------------------------------------------

describe("POST /api/business/active — cross-tenant access prevention", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("returns 403 when user tries to claim a business they are not a member of", async () => {
        // user-1 is only a member of business-a
        // they forge a request to set their active business to business-b
        asBusinessAUser()
        mockMembershipFindFirst.mockResolvedValue(null) // no membership record found

        const res = await POST(makePostRequest({ businessId: "business-b" }) as any)

        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.error).toMatch(/forbidden/i)
    })

    it("confirms the membership check was performed against the forged businessId", async () => {
        asBusinessAUser()
        mockMembershipFindFirst.mockResolvedValue(null)

        await POST(makePostRequest({ businessId: "business-b" }) as any)

        // system must have verified membership in business-b specifically
        expect(mockMembershipFindFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ businessId: "business-b" }),
            })
        )
    })

    it("returns 401 when an unauthenticated request attempts to switch business", async () => {
        vi.mocked(getServerSession).mockResolvedValue(null)

        const res = await POST(makePostRequest({ businessId: "business-b" }) as any)

        expect(res.status).toBe(401)
    })

    it("returns 400 when no businessId is supplied in the request body", async () => {
        asBusinessAUser()

        const res = await POST(makePostRequest({}) as any)

        expect(res.status).toBe(400)
    })

    it("rejects malformed hostile businessId payloads and performs no membership lookup", async () => {
        asBusinessAUser()

        const req = makePostRequest({
            // hostile payload attempts object injection instead of a valid tenant id string
            businessId: { $ne: "business-a" },
        })

        const res = await POST(req as any)
        const body = await res.json()

        // malformed tenant identifiers must never be accepted as valid switch requests
        expect(res.status).toBeGreaterThanOrEqual(400)
        expect(body.error).toBeTruthy()
        expect(mockMembershipFindFirst).not.toHaveBeenCalled()
    })

    it("allows a user to activate a business they legitimately belong to", async () => {
        asBusinessAUser()
        mockMembershipFindFirst.mockResolvedValue({ businessId: "business-a" })

        const res = await POST(makePostRequest({ businessId: "business-a" }) as any)

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.ok).toBe(true)
        expect(body.businessId).toBe("business-a")
    })

    it("sets the uc_default_business cookie only after a successful membership verification", async () => {
        asBusinessAUser()
        mockMembershipFindFirst.mockResolvedValue({ businessId: "business-a" })

        const res = await POST(makePostRequest({ businessId: "business-a" }) as any)

        const setCookie = res.headers.get("set-cookie") ?? ""
        expect(setCookie).toContain("uc_default_business")
        expect(setCookie).toContain("business-a")
    })
})

// ---------------------------------------------------------------------------
// database-per-tenant isolation via /api/business/users
// ---------------------------------------------------------------------------

describe("GET /api/business/users — database silo isolation", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFindMany.mockResolvedValue([])
        mockCount.mockResolvedValue(0)
    })

    it("only opens a connection to business-a database when authenticated as a business-a user", async () => {
        asBusinessAUser()

        await GET(new Request("http://localhost/api/business/users") as any)

        // the system must open the business-a silo only — never business-b
        expect(getBusinessPrisma).toHaveBeenCalledWith("business-a")
        expect(getBusinessPrisma).not.toHaveBeenCalledWith("business-b")
    })

    it("never exposes business-b data when the requestor is authenticated as business-a", async () => {
        asBusinessAUser()

        const businessAUsers = [
            { id: "ua1", email: "alice@a.com", displayName: "Alice", role: "OWNER" },
        ]
        mockFindMany.mockResolvedValue(businessAUsers)
        mockCount.mockResolvedValue(1)

        const res = await GET(new Request("http://localhost/api/business/users") as any)
        const body = await res.json()

        expect(body.users).toEqual(businessAUsers)
        expect(body.totalCount).toBe(1)
    })

    it("returns 401 and never touches the database when the request has no auth", async () => {
        vi.mocked(getServerSession).mockResolvedValue(null)
        vi.mocked(getToken).mockResolvedValue(null)

        const res = await GET(new Request("http://localhost/api/business/users") as any)

        expect(res.status).toBe(401)
        // db connection must never have been opened
        expect(getBusinessPrisma).not.toHaveBeenCalled()
    })
})
