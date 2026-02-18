// Approver-related types derived from the Prisma (business) schema
// Generated client location: app/generated/business/prisma

import type {
  Prisma,
  Approver as PrismaApprover,
  BusinessUser as PrismaBusinessUser,
  APPROVAL_STATUS,
} from '@/app/generated/business/prisma'

// Base model type (default selection = all scalar fields)
export type Approver = PrismaApprover
export type ApproverUser = PrismaBusinessUser

// Enum for approval status
export type ApprovalStatus = APPROVAL_STATUS

// Common payloads
export type ApproverWithUser = Prisma.ApproverGetPayload<{ include: { user: true } }>

// Lightweight shape used in UI lists
export type ApproverListItem = Approver & {
  user: ApproverUser
}
