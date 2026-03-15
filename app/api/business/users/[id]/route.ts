import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getBusinessPrisma } from "@/lib/prisma-business"
import prismaMain from "@/lib/prisma-main"
import { UserRole } from "@/app/generated/business/prisma"
import { hasRolePermission, RolePermissions } from "@/lib/role-permissions"

// Define role permissions for different operations
const PERMISSIONS = {
    UPDATE_OWN_DISPLAY_NAME: RolePermissions.ALL_USERS, // Any user can update their own name
    UPDATE_OTHER_USERS: RolePermissions.ADMIN_AND_OWNER, // Only admin/owner can update others
    CHANGE_ROLES: RolePermissions.ADMIN_AND_OWNER, // Only admin/owner can change roles
    DELETE_USERS: RolePermissions.ADMIN_AND_OWNER, // Only admin/owner can delete users
} as const

/**
 * @swagger
 * /api/business/users/{id}:
 *   patch:
 *     summary: Update a business user profile or role
 *     tags:
 *       - Business
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Business user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Invalid payload or business rule violation
 *       401:
 *         description: Unauthorized or insufficient permission
 *       404:
 *         description: User not found
 *       500:
 *         description: Failed to update user
 */
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
        const isSelf = target.id === actor.id

        // Permission check: Anyone can update their own display name
        if (displayName !== undefined && isSelf) {
            // Self update of display name - check if user has permission
            if (!hasRolePermission(actorRole, PERMISSIONS.UPDATE_OWN_DISPLAY_NAME)) {
                return NextResponse.json(
                    { error: "You do not have permission to update your display name" },
                    { status: 401 }
                )
            }
        }

        // Permission check: Only admins/owners can update other users
        if (!isSelf && !hasRolePermission(actorRole, PERMISSIONS.UPDATE_OTHER_USERS)) {
            return NextResponse.json(
                { error: "You do not have permission to update other users" },
                { status: 401 }
            )
        }

        // Permission check: Role changes require admin/owner privileges (even for self)
        if (nextRole !== undefined && nextRole !== targetRole) {
            if (!hasRolePermission(actorRole, PERMISSIONS.CHANGE_ROLES)) {
                return NextResponse.json(
                    { error: "You do not have permission to change roles" },
                    { status: 401 }
                )
            }

            // Additional validation: Admins cannot promote to or demote owners
            if (hasRolePermission(actorRole, [UserRole.ADMIN])) {
                if (targetRole === UserRole.OWNER || nextRole === UserRole.OWNER) {
                    return NextResponse.json(
                        { error: "Only owners can change owner roles" },
                        { status: 401 }
                    )
                }
            }

            // Prevent owners from demoting themselves
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

/**
 * @swagger
 * /api/business/users/{id}:
 *   delete:
 *     summary: Remove a user from a business
 *     tags:
 *       - Business
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Business user ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       400:
 *         description: Invalid operation (e.g., deleting self or last owner)
 *       401:
 *         description: Unauthorized or insufficient permission
 *       404:
 *         description: User not found
 *       500:
 *         description: Failed to delete user
 */
export const DELETE = async (
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) => {
    try {
        const auth = await requireAuth(req)
        if (!auth.ok) return auth.response

        const { id } = await context.params
        const prisma = await getBusinessPrisma(auth.businessId!)

        const actor = await prisma.businessUser.findUnique({ where: { id: auth.userId! } })
        if (!actor) {
            return NextResponse.json({ error: "Authenticated user not found" }, { status: 401 })
        }

        const target = await prisma.businessUser.findUnique({ where: { id } })
        if (!target) {
            return NextResponse.json({ error: "User not found" }, { status: 404 })
        }

        if (actor.id === target.id) {
            return NextResponse.json(
                { error: "You cannot delete your own account" },
                { status: 400 }
            )
        }

        const actorRole = actor.role
        const targetRole = target.role
        const actorIsOwner = actorRole === UserRole.OWNER
        const actorIsAdmin = actorRole === UserRole.ADMIN

        // Permission check: Only admins/owners can delete users
        if (!hasRolePermission(actorRole, PERMISSIONS.DELETE_USERS)) {
            return NextResponse.json(
                { error: "You do not have permission to delete users" },
                { status: 401 }
            )
        }

        if (actorIsAdmin) {
            if (targetRole === UserRole.OWNER || targetRole === UserRole.ADMIN) {
                return NextResponse.json(
                    { error: "Admins cannot delete owners or other admins" },
                    { status: 401 }
                )
            }
        }

        if (targetRole === UserRole.OWNER) {
            const ownerCount = await prisma.businessUser.count({ where: { role: UserRole.OWNER } })
            if (ownerCount <= 1) {
                return NextResponse.json(
                    { error: "Cannot delete the last owner" },
                    { status: 400 }
                )
            }
        }

        // Remove membership from main database if present
        const mainUser = await prismaMain.user.findUnique({ where: { email: target.email } })
        if (mainUser) {
            await prismaMain.usersOnBusinesses.deleteMany({
                where: { userId: mainUser.id, businessId: auth.businessId! },
            })
        }

        await prisma.businessUser.delete({ where: { id } })

        return NextResponse.json({ deleted: true, id })
    } catch (err: any) {
        console.error("Error deleting user:", err)
        return NextResponse.json(
            { error: err?.message || "Failed to delete user" },
            { status: 500 }
        )
    }
}
