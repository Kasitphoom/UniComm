import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import SalesforceProvider from "next-auth/providers/salesforce"
import prisma from "@/lib/prisma-main"
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
                return { id: user.id, email: user.email } as any
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
                return true
            }
            return true
        },
        async jwt({ token, user }) {
            // On sign in, ensure token.id comes from our main DB and attach memberships.
            if (user) {
                const userId = (user as any).id as string | undefined
                if (userId) (token as any).id = userId
                try {
                    const memberships = userId
                        ? await prisma.usersOnBusinesses.findMany({
                              where: { userId },
                              select: { businessId: true, role: true },
                          })
                        : []
                    ;(token as any).businessIds = memberships.map((m) => m.businessId)
                    ;(token as any).memberships = memberships
                } catch {
                    ;(token as any).businessIds = []
                    ;(token as any).memberships = []
                }
            }
            return token
        },
        async session({ session, token }) {
            if (session?.user) {
                ;(session.user as any).id = token.id as string
                ;(session.user as any).businessIds =
                    (token as any).businessIds || []
                ;(session.user as any).memberships =
                    (token as any).memberships || []
            }
            return session
        },
    },
}

export default authOptions
