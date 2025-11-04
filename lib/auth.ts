import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import SalesforceProvider from "next-auth/providers/salesforce"
import prisma from "@/lib/prisma-main"
import { getBusinessPrisma } from "@/lib/prisma-business"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
    session: { strategy: "jwt" },
    pages: {
        signIn: "/",
        error: "/",
    },
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                if (!credentials?.email || !credentials?.password) return null
                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                })
                if (!user || !user.password) return null
                const ok = await bcrypt.compare(
                    credentials.password,
                    user.password
                )
                if (!ok) return null
                return { id: user.id, email: user.email, name: user.name ?? null } as any
            },
        }),
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        }),
        SalesforceProvider({
            clientId: process.env.SALESFORCE_CLIENT_ID || "",
            clientSecret: process.env.SALESFORCE_CLIENT_SECRET || "",
            checks: ["pkce", "state"],
            authorization: {
                params: {
                    response_type: "code",
                    scope: "email profile",
                    code_challenge_method: "S256",
                },
            },
        }),
    ],
    callbacks: {
        async signIn({ user, account }) {
            // Never create users. For OAuth (Google), only allow if user already exists by email.
            if (account?.provider === 'google') {
                const email = (user as any)?.email
                if (!email) return false
                const existing = await prisma.user.findUnique({ where: { email } })
                if (!existing) return false
                // Pass the DB id through to jwt via user.id
                ;(user as any).id = existing.id
                ;(user as any).name = existing.name ?? null
                return true
            }

            if (account?.provider === 'salesforce') {
                console.log( "Salesforce sign in callback", user, account );
                const email = (user as any)?.email
                if (!email) return false
                const existing = await prisma.user.findUnique({ where: { email } })
                if (!existing) return false;
                // Pass the DB id through to jwt via user.id
                (user as any).id = existing.id
                ;(user as any).name = existing.name ?? null
                return true
            }
            return true
        },
        async jwt({ token, user, trigger, session }) {
            // On sign in, ensure token.id comes from our main DB and attach memberships.
            if (user) {
                const userId = (user as any).id as string | undefined
                if (userId) (token as any).id = userId
                if ((user as any)?.name !== undefined) {
                    ;(token as any).name = (user as any).name
                }
                try {
                    const memberships = userId
                        ? await prisma.usersOnBusinesses.findMany({
                              where: { userId },
                              select: { businessId: true, role: true },
                          })
                        : []
                    ;(token as any).businessIds = memberships.map((m) => m.businessId)
                    ;(token as any).memberships = memberships

                    // Determine and cache ONLY the current business profile for the selected/active business
                    // Resolve the user's email for BusinessUser lookup
                    let email: string | null = (user as any)?.email ?? (token as any)?.email ?? null
                    if (!email && userId) {
                        const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
                        email = dbUser?.email ?? null
                    }

                    // Pick active business if already set; otherwise, if single membership, default to it
                    let activeId: string | null = (token as any).activeBusinessId ?? null
                    if (!activeId && memberships.length === 1) {
                        activeId = memberships[0].businessId
                        ;(token as any).activeBusinessId = activeId
                    }

                    let currentProfile: { businessId: string, email: string, displayName: string, role: string } | null = null
                    if (email && activeId) {
                        try {
                            const bpClient = getBusinessPrisma(activeId)
                            const bu = await bpClient.businessUser.findUnique({ where: { email } })
                            if (bu) {
                                currentProfile = {
                                    businessId: activeId,
                                    email: (bu as any).email,
                                    displayName: (bu as any).displayName ?? '',
                                    role: String((bu as any).role),
                                }
                            }
                        } catch {
                            // ignore lookup errors
                        }
                    }
                    ;(token as any).currentBusinessProfile = currentProfile
                } catch {
                    ;(token as any).businessIds = []
                    ;(token as any).memberships = []
                    ;(token as any).currentBusinessProfile = null
                }
            }

            // Support updating the active business id via useSession().update({ activeBusinessId })
            if (trigger === 'update' && session && (session as any).activeBusinessId) {
                const requested = (session as any).activeBusinessId as string
                const allowed: string[] = ((token as any).businessIds as string[]) || []
                if (allowed.includes(requested)) {
                    ;(token as any).activeBusinessId = requested

                    // Update current business profile when active business changes
                    try {
                        const userId = (token as any).id as string | undefined
                        // Resolve email
                        let email: string | null = (token as any)?.email ?? null
                        if (!email && userId) {
                            const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
                            email = dbUser?.email ?? null
                        }
                        let currentProfile: any = null
                        if (email) {
                            const bpClient = getBusinessPrisma(requested)
                            const bu = await bpClient.businessUser.findUnique({ where: { email } })
                            if (bu) {
                                currentProfile = {
                                    businessId: requested,
                                    email: (bu as any).email,
                                    displayName: (bu as any).displayName ?? '',
                                    role: String((bu as any).role),
                                }
                            }
                        }
                        ;(token as any).currentBusinessProfile = currentProfile
                    } catch {
                        ;(token as any).currentBusinessProfile = null
                    }
                }
            }

            return token
        },
        async session({ session, token }) {
            if (session?.user) {
                ;(session.user as any).id = token.id as string
                if ((token as any).name !== undefined) {
                    ;(session.user as any).name = (token as any).name
                }
                ;(session.user as any).businessIds =
                    (token as any).businessIds || []
                ;(session.user as any).memberships =
                    (token as any).memberships || []
                ;(session.user as any).activeBusinessId = (token as any).activeBusinessId || null
                ;(session.user as any).currentBusinessProfile = (token as any).currentBusinessProfile || null
            }
            // Also expose activeBusinessId at the session root for server-side convenience
            ;(session as any).activeBusinessId = (token as any).activeBusinessId || null
            return session
        },
    },
}

export default authOptions
