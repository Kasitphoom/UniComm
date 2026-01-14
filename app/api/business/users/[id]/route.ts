import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getBusinessPrisma } from "@/lib/prisma-business"
import { UserRole } from "@/app/generated/business/prisma"

export const PATCH = async (
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    try {
        const auth = await requireAuth(req)
        if (!auth.ok) return auth.response

        const { id } = await context.params
        const prisma = await getBusinessPrisma(auth.businessId!)

        const body = (await req.json().catch(() => ({}))) as {
            displayName?: unknown
            role?: unknown
        }

        const displayName = typeof body.displayName === "string" ? body.displayName.trim() : undefined
        const roleInput = body.role as UserRole | undefined

        if (!displayName && roleInput === undefined) {
            return NextResponse.json(
                { error: "At least one of displayName or role must be provided" },
                { status: 400 }
            )
        }

        if (displayName !== undefined) {
            if (displayName.length < 2 || displayName.length > 50) {
                return NextResponse.json(
                    { error: "Display name must be between 2 and 50 characters" },
                    { status: 400 }
                )
            }
        }

        let nextRole: UserRole | undefined
        if (roleInput !== undefined) {
            if (!Object.values(UserRole).includes(roleInput)) {
                return NextResponse.json(
                    { error: "Invalid role" },
                    { status: 400 }
                )
            }
            nextRole = roleInput
        }

        const actor = await prisma.businessUser.findUnique({ where: { id: auth.userId! } })
        if (!actor) {
            return NextResponse.json({ error: "Authenticated user not found" }, { status: 401 })
        }

        const target = await prisma.businessUser.findUnique({ where: { id } })
        if (!target) {
            return NextResponse.json({ error: "User not found" }, { status: 404 })
        }

        const actorRole = actor.role
        const targetRole = target.role
        const actorIsOwner = actorRole === UserRole.OWNER
        const actorIsAdmin = actorRole === UserRole.ADMIN
        const isSelf = target.id === actor.id

        if (!isSelf && !(actorIsOwner || actorIsAdmin)) {
            return NextResponse.json(
                { error: "You do not have permission to update other users" },
                { status: 403 }
            )
        }

        if (nextRole !== undefined) {
            if (!actorIsOwner && !actorIsAdmin) {
                return NextResponse.json(
                    { error: "You do not have permission to change roles" },
                    { status: 403 }
                )
            }

            if (actorIsAdmin) {
                if (targetRole === UserRole.OWNER || nextRole === UserRole.OWNER) {
                    return NextResponse.json(
                        { error: "Only owners can change owner roles" },
                        { status: 403 }
                    )
                }
            }

            if (isSelf && actorRole === UserRole.OWNER && nextRole !== UserRole.OWNER) {
                return NextResponse.json(
                    { error: "Owners cannot remove their own owner role" },
                    { status: 400 }
                )
            }
        }

        const data: Partial<{ displayName: string; role: UserRole }> = {}
        if (displayName !== undefined) data.displayName = displayName
        if (nextRole !== undefined) data.role = nextRole

        const user = await prisma.businessUser.update({
            where: { id },
            data,
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        })

        return NextResponse.json({ user })
    } catch (err: any) {
        console.error("Error updating user:", err)
        return NextResponse.json(
            { error: err?.message || "Failed to update user" },
            { status: 500 }
        )
    }
}
