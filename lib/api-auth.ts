import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { getToken } from "next-auth/jwt"
import type { Session } from "next-auth"
import type { JWT } from "next-auth/jwt"
import authOptions from "@/lib/auth"
import { cookies as nextCookies } from "next/headers"
import { DEFAULT_BUSINESS_COOKIE } from "@/types/business"

export type ApiAuth = {
    session: Session | null
    token: JWT | null
    userId: string | null
    mainUserId: string | null
    businessId: string | null
}

// Extract auth from either NextAuth cookie-based session or Bearer token.
// - Prefers session when available (getServerSession)
// - Falls back to Authorization: Bearer <jwt> via next-auth/jwt getToken
// - Derives current businessId from session/token extensions set in callbacks
// - Falls back to DEFAULT_BUSINESS_COOKIE when present
export async function authenticateApi(req: Request): Promise<ApiAuth> {
    // 1) Try cookie-session first (works for same-origin calls)
    const session = await getServerSession(authOptions).catch(() => null)

    // 2) Try bearer token from Authorization header
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
    const token = await getToken({
        req: req as any,
        secret,
        raw: false,
    }).catch(() => null)

    const userId =
        ((session?.user as any)?.currentBusinessProfile?.id as string | undefined) ??
        ((token as any)?.currentBusinessProfile?.id as string | undefined) ??
        ((session?.user as any)?.id as string | undefined) ??
        ((token as any)?.id as string | undefined) ??
        null

    const mainUserId =
        ((session?.user as any)?.id as string | undefined) ??
        ((token as any)?.id as string | undefined) ??
        null

    let businessId: string | null =
        ((session as any)?.activeBusinessId as string | undefined) ??
        ((session?.user as any)?.activeBusinessId as string | undefined) ??
        ((session?.user as any)?.currentBusinessProfile?.businessId as
            | string
            | undefined) ??
        ((token as any)?.activeBusinessId as string | undefined) ??
        ((token as any)?.currentBusinessProfile?.businessId as
            | string
            | undefined) ??
        null

    if (!businessId) {
        try {
            const store = nextCookies() // in Next.js 13/14 headers variant this is synchronous
            // @ts-expect-error: runtime type may differ in edge/server contexts
            businessId = store.get?.(DEFAULT_BUSINESS_COOKIE)?.value ?? null
        } catch {
            // ignore
        }
    }

    return { session, token: token as JWT | null, userId, mainUserId, businessId }
}

export type RequireAuthResult =
    | (ApiAuth & { ok: true })
    | { ok: false; response: NextResponse }

// Helper guard for route handlers. Usage:
// const auth = await requireAuth(req); if (!auth.ok) return auth.response; const { userId, businessId } = auth
export async function requireAuth(
    req: Request,
    opts: { requireBusiness?: boolean } = { requireBusiness: true }
): Promise<RequireAuthResult> {
    const auth = await authenticateApi(req)
    if (!auth.userId) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            ),
        }
    }
    if (opts.requireBusiness && !auth.businessId) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "No active business selected" },
                { status: 400 }
            ),
        }
    }
    return { ok: true, ...auth }
}
