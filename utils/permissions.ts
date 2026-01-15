import { UserRole } from "@/app/generated/business/prisma"

/**
 * Check if a user has permission based on allowed roles
 * @param userRole - The role of the current user
 * @param allowedRoles - Array of roles that have permission
 * @returns true if user has permission, false otherwise
 */
export const hasPermission = (userRole: string | null | undefined, allowedRoles: UserRole[]): boolean => {
    if (!userRole) return false
    return allowedRoles.includes(userRole as UserRole)
}

/**
 * Check if user can delete a resource (owner or admin)
 * @param isOwner - Whether the user owns the resource
 * @param userRole - The role of the current user
 * @returns true if user can delete, false otherwise
 */
export const canDeleteResource = (isOwner: boolean, userRole: string | null | undefined): boolean => {
    const deleteRoles: UserRole[] = [UserRole.OWNER, UserRole.ADMIN]
    return isOwner || hasPermission(userRole, deleteRoles)
}

/**
 * Check if user can create resources (templates, components)
 * @param userRole - The role of the current user
 * @returns true if user can create, false otherwise
 */
export const canCreateResource = (userRole: string | null | undefined): boolean => {
    const createRoles: UserRole[] = [UserRole.OWNER, UserRole.ADMIN, UserRole.MEMBER]
    return hasPermission(userRole, createRoles)
}
