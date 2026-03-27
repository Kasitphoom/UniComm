// for dissertation section — black-box security testing
// tests the authentication gates on /api/business/users without knowing
// any internal implementation — only http status codes are asserted
import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "@/app/api/business/users/route"
import { getServerSession } from "next-auth"
import { getToken } from "next-auth/jwt"

// vi.mock factories are hoisted before variable declarations,
// so mock fns must be declared with vi.hoisted() to be accessible inside the factory
const { mockFindMany, mockCount } = vi.hoisted(() => ({
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
vi.mock("@/lib/prisma-business", () => ({
    getBusinessPrisma: vi.fn().mockReturnValue({
        businessUser: { findMany: mockFindMany, count: mockCount },
    }),
}))

function makeRequest(url = "http://localhost/api/business/users") {
    return new Request(url)
}

beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.mocked(getToken).mockResolvedValue(null)
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)
})

describe("GET /api/business/users — authentication boundary", () => {
    it("returns 401 when no session and no token is present", async () => {
        // no auth at all — the requireAuth guard should block the request
        const res = await GET(makeRequest() as any)
        expect(res.status).toBe(401)
    })

    it("returns 401 when an invalid/expired token is provided", async () => {
        vi.mocked(getServerSession).mockResolvedValue(null)
        vi.mocked(getToken).mockResolvedValue(null)

        const res = await GET(makeRequest() as any)
        expect(res.status).toBe(401)

        const body = await res.json()
        expect(body.error).toMatch(/unauthorized/i)
    })

    it("returns 400 when user is authenticated but has no active business selected", async () => {
        // valid user id but no businessId anywhere in session/token/cookie
        vi.mocked(getToken).mockResolvedValue({
            id: "user-1",
            // deliberately omit activeBusinessId and currentBusinessProfile
        } as any)

        const res = await GET(makeRequest() as any)
        expect(res.status).toBe(400)

        const body = await res.json()
        expect(body.error).toMatch(/no active business/i)
    })

    it("returns 200 when user is authenticated with a valid business context", async () => {
        vi.mocked(getToken).mockResolvedValue({
            id: "user-1",
            activeBusinessId: "business-a",
        } as any)

        const res = await GET(makeRequest() as any)
        expect(res.status).toBe(200)
    })

    it("response body contains expected pagination fields on success", async () => {
        vi.mocked(getToken).mockResolvedValue({
            id: "user-1",
            activeBusinessId: "business-a",
        } as any)

        mockFindMany.mockResolvedValue([
            { id: "u1", email: "alice@a.com", displayName: "Alice", role: "MEMBER" },
        ])
        mockCount.mockResolvedValue(1)

        const res = await GET(makeRequest() as any)
        const body = await res.json()

        expect(body).toHaveProperty("users")
        expect(body).toHaveProperty("totalCount")
        expect(body).toHaveProperty("currentPage")
        expect(body).toHaveProperty("totalPages")
    })
})
