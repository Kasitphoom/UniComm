import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import prisma from "@/lib/prisma-main"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
    session: { strategy: "jwt" },
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
    ],
    callbacks: {
        async jwt({ token, user }) {
            // On first sign in, enrich token with user id and business memberships
            if (user) {
                token.id = (user as any).id
                try {
                    const memberships = await prisma.usersOnBusinesses.findMany(
                        {
                            where: { userId: (user as any).id },
                            select: { businessId: true, role: true },
                        }
                    )
                    token.businessIds = memberships.map((m) => m.businessId)
                    token.memberships = memberships // [{ businessId, role }]
                } catch (e) {
                    // If fetching memberships fails, keep token minimal
                    token.businessIds = []
                    token.memberships = []
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
