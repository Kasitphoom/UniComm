// Centralized business-related types shared across the app
// Keep DTOs separate from Prisma types to avoid coupling API responses to the DB layer.

// Canonical cookie name we use to persist the user's preferred business on the client
export const DEFAULT_BUSINESS_COOKIE = "uc_default_business"

// Business identifier (Prisma uses ObjectId stored as string in this project)
export type BusinessId = string

// Roles for a user's membership in a business
// Mirror of prisma enum UserBusinessRole without importing prisma types
export type UserBusinessRole = "OWNER" | "ADMIN" | "MEMBER"

// Minimal Business shape as returned by API endpoints
export interface BusinessDTO {
  id: BusinessId
  name: string
  createdAt?: string | Date
  updatedAt?: string | Date
  // Optional description for future-proofing/UI; not persisted in main schema currently
  description?: string | null
}

// A single membership entry connecting a user to a business
export interface BusinessMembershipDTO {
  businessId: BusinessId
  role: UserBusinessRole
}

// Business with the memberships array (common in list endpoints)
export type BusinessWithMembershipsDTO = BusinessDTO & {
  memberships: BusinessMembershipDTO[]
}

// Response payload for GET /api/business
export interface BusinessListResponse {
  businesses: BusinessWithMembershipsDTO[]
}

// Payload used to set/update the active business in the session via useSession().update()
export interface ActiveBusinessUpdatePayload {
  activeBusinessId: BusinessId
}
