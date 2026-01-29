import type {
  Prisma,
  ComponentBlock as PrismaComponentBlock,
  BusinessUser as PrismaBusinessUser,
  ComponentBlockVersion,
  Approver,
} from '@/app/generated/business/prisma'

export type ComponentBlock = PrismaComponentBlock
export type ComponentBlockUser = PrismaBusinessUser
export type ComponentBlockWithUser = Prisma.ComponentBlockGetPayload<{ include: { user: true, versions: true } }>

export type ComponentBlockListItem = ComponentBlock & {
  userId: string
  user: ComponentBlockUser
  versions: ComponentBlockVersion[]
  approvers?: Approver[]
}

export type ComponentBlockListResult = {
  componentBlocks: ComponentBlockListItem[]
  currentPage: number
  total: number
}
