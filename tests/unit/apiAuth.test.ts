import { beforeEach, describe, expect, it, vi } from "vitest"
import { getServerSession } from "next-auth"
import { getToken } from "next-auth/jwt"
import { cookies } from "next/headers"
import {
    authenticateApi,
    requireAuth,
    requireCronAuth,
} from "@/lib/api-auth"

vi.mock("next-auth", () => ({
    getServerSession: vi.fn(),
}))

vi.mock("next-auth/jwt", () => ({
    getToken: vi.fn(),
}))

vi.mock("next/headers", () => ({
    cookies: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
    default: {},
}))

vi.mock("@/app/generated/business/prisma", () => ({
    UserRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER" },
}))

describe("authenticateApi", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        delete process.env.NEXTAUTH_SECRET
        delete process.env.AUTH_SECRET
    })

    it("prefers session business profile and active business details", async () => {
        vi.mocked(getServerSession).mockResolvedValue({
            activeBusinessId: "business-session",
            user: {
                id: "main-user-id",
                currentBusinessProfile: {
                    id: "profile-user-id",
                    businessId: "business-profile",
                },
            },
        } as any)
        vi.mocked(getToken).mockResolvedValue(null)

        const auth = await authenticateApi(new Request("http://localhost/api/test"))

        expect(auth.userId).toBe("profile-user-id")
        expect(auth.mainUserId).toBe("main-user-id")
        expect(auth.businessId).toBe("business-session")
    })

    it("falls back to token and cookie business id when session business context is absent", async () => {
        process.env.AUTH_SECRET = "auth-secret"
        vi.mocked(getServerSession).mockResolvedValue({ user: {} } as any)
        vi.mocked(getToken).mockResolvedValue({
            id: "token-user-id",
        } as any)
        vi.mocked(cookies).mockResolvedValue({
            get: vi.fn().mockReturnValue({ value: "business-cookie" }),
        } as any)

        const auth = await authenticateApi(new Request("http://localhost/api/test"))

        expect(auth.userId).toBe("token-user-id")
        expect(auth.businessId).toBe("business-cookie")
        expect(vi.mocked(getToken)).toHaveBeenCalledWith(
            expect.objectContaining({
                secret: "auth-secret",
            }),
        )
    })

    it("returns null business id when cookie access throws", async () => {
        vi.mocked(getServerSession).mockResolvedValue({ user: {} } as any)
        vi.mocked(getToken).mockResolvedValue({ id: "token-user-id" } as any)
        vi.mocked(cookies).mockRejectedValue(new Error("cookie store unavailable"))

        const auth = await authenticateApi(new Request("http://localhost/api/test"))

        expect(auth.userId).toBe("token-user-id")
        expect(auth.businessId).toBeNull()
    })

    it("handles getServerSession and getToken failures gracefully", async () => {
        vi.mocked(getServerSession).mockRejectedValue(new Error("session failed"))
        vi.mocked(getToken).mockRejectedValue(new Error("token failed"))
        vi.mocked(cookies).mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) } as any)

        const auth = await authenticateApi(new Request("http://localhost/api/test"))

        expect(auth.userId).toBeNull()
        expect(auth.mainUserId).toBeNull()
        expect(auth.businessId).toBeNull()
    })
})

describe("requireAuth", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("returns 401 when no authenticated user id can be derived", async () => {
        vi.mocked(getServerSession).mockResolvedValue(null)
        vi.mocked(getToken).mockResolvedValue(null)
        vi.mocked(cookies).mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) } as any)

        const result = await requireAuth(new Request("http://localhost/api/test"))

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.response.status).toBe(401)
        }
    })

    it("returns 400 when user is authenticated but no business is selected", async () => {
        vi.mocked(getServerSession).mockResolvedValue({
            user: { id: "user-1" },
        } as any)
        vi.mocked(getToken).mockResolvedValue(null)
        vi.mocked(cookies).mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) } as any)

        const result = await requireAuth(new Request("http://localhost/api/test"))

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.response.status).toBe(400)
        }
    })

    it("allows authenticated requests when business check is disabled", async () => {
        vi.mocked(getServerSession).mockResolvedValue({
            user: { id: "user-1" },
        } as any)
        vi.mocked(getToken).mockResolvedValue(null)
        vi.mocked(cookies).mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) } as any)

        const result = await requireAuth(new Request("http://localhost/api/test"), {
            requireBusiness: false,
        })

        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.userId).toBe("user-1")
        }
    })
})

describe("requireCronAuth", () => {
    beforeEach(() => {
        delete process.env.CRON_JOBS_SECRET
    })

    it("returns 401 when cron secret is missing", async () => {
        const result = await requireCronAuth(new Request("http://localhost/api/test"))

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.response.status).toBe(401)
        }
    })

    it("returns 401 when bearer token does not match the cron secret", async () => {
        process.env.CRON_JOBS_SECRET = "expected-secret"
        const req = new Request("http://localhost/api/test", {
            headers: { Authorization: "Bearer wrong-secret" },
        })

        const result = await requireCronAuth(req)

        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.response.status).toBe(401)
        }
    })

    it("returns ok when authorization header matches configured cron secret", async () => {
        process.env.CRON_JOBS_SECRET = "expected-secret"
        const req = new Request("http://localhost/api/test", {
            headers: { Authorization: "Bearer expected-secret" },
        })

        const result = await requireCronAuth(req)

        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.userId).toBeNull()
            expect(result.businessId).toBeNull()
        }
    })
})
