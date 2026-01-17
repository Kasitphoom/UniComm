import { UserRole } from "@/app/generated/business/prisma"

/**
 * Special role value that allows any authenticated user to access the resource
 */
export const ALL_ROLES = "ALL" as const

/**
 * Type for role permissions - can be an array of UserRole values or the special "ALL" value
 */
export type RolePermission = UserRole[] | typeof ALL_ROLES

/**
 * Check if a user's role has permission based on the allowed roles array
 * @param userRole - The role of the user attempting the action
 * @param allowedRoles - Array of allowed roles or "ALL" to allow any role
 * @returns true if the user has permission, false otherwise
 */
export function hasRolePermission(
    userRole: UserRole | string | null | undefined,
    allowedRoles: RolePermission
): boolean {
    // If no role is provided, deny access
    if (!userRole) return false

    // If "ALL" is specified, any authenticated user has permission
    if (allowedRoles === ALL_ROLES) return true

    // Check if user's role is in the allowed roles array
    return allowedRoles.includes(userRole as UserRole)
}

/**
 * Common role permission presets for easy reuse
 */
export const RolePermissions = {
    OWNER_ONLY: [UserRole.OWNER] as RolePermission,
    ADMIN_AND_OWNER: [UserRole.OWNER, UserRole.ADMIN] as RolePermission,
    ALL_USERS: ALL_ROLES as RolePermission,
    OWNER_ADMIN_AUDITOR: [UserRole.OWNER, UserRole.ADMIN, UserRole.AUDITOR] as RolePermission,
} as const
