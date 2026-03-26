import { NextResponse } from "next/server"
import * as Ably from "ably"
import { requireAuth } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const POST = async (req: Request) => {
    try {
        const auth = await requireAuth(req, { requireBusiness: false })
        if (!auth.ok) {
            return auth.response
        }

        const apiKey = process.env.ABLY_SUBSCRIBE_API_KEY?.trim() || process.env.ABLY_API_KEY?.trim()
        if (!apiKey) {
            return NextResponse.json(
                { error: "ABLY_SUBSCRIBE_API_KEY or ABLY_API_KEY is not configured" },
                { status: 503 },
            )
        }

        const clientId = auth.mainUserId || auth.userId || "unknown-user"
        const capability = JSON.stringify({ "campaign-progress:*": ["subscribe"] })
        const ably = new Ably.Rest(apiKey)

        const tokenRequest = await ably.auth.createTokenRequest({
            clientId,
            capability,
            ttl: 60 * 60 * 1000,
        })

        return NextResponse.json(tokenRequest)
    } catch (error) {
        console.error("Failed to create Ably token request:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unable to create token" },
            { status: 500 },
        )
    }
}
