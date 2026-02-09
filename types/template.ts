// Template-related types derived from the Prisma (business) schema
// Generated client location: app/generated/business/prisma

import type {
  Prisma,
  Templates as PrismaTemplate,
  BusinessUser as PrismaBusinessUser,
  TemplateVersion,
} from '@/app/generated/business/prisma'

import type { ApproverWithUser } from '@/types/approver'

// Base model types (default selection = all scalar fields)
export type Template = PrismaTemplate
export type TemplateUser = PrismaBusinessUser

// Rich payloads using Prisma helpers
export type TemplateAPIResponse = Prisma.TemplatesGetPayload<{ include: { user: true, versions: true, contactList: true, approvers: { include: { user: true } } } }>

// DTOs for create/update operations
// Note: prefer CreateInput to use relation connect; use Unchecked* when setting userId directly.
export type TemplateCreateInput = Prisma.TemplatesCreateInput
export type TemplateUncheckedCreateInput = Prisma.TemplatesUncheckedCreateInput
export type TemplateUpdateInput = Prisma.TemplatesUpdateInput
export type TemplateUncheckedUpdateInput = Prisma.TemplatesUncheckedUpdateInput

export type TemplateWithUser = TemplateAPIResponse & {
  requireUserApproval?: boolean
}

// Lightweight shapes commonly used in UI lists
export type TemplateListItem = TemplateAPIResponse & {
  userId: string
  user: TemplateUser
  versions: TemplateVersion[]
  approvers?: ApproverWithUser[]
  requireUserApproval: boolean
}

export type TemplateQuery = {
  // Free-text search mapped to title or other fields in your query layer
  query?: string
  // Pagination (cursor/skip/take can be swapped as needed)
  skip?: number
  take?: number
}

export type TemplateListResult = {
  templates: TemplateListItem[]
  currentPage: number
  total: number // total pages
}

// Convenience helpers for ordering in queries (optional)
export type TemplateOrderBy = Prisma.TemplatesOrderByWithRelationInput
