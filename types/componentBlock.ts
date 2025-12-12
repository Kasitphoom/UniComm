import type {
  Prisma,
  ComponentBlock as PrismaComponentBlock,
  BusinessUser as PrismaBusinessUser,
  ComponentBlockVersion,
} from '@/app/generated/business/prisma'

export type ComponentBlock = PrismaComponentBlock
export type ComponentBlockUser = PrismaBusinessUser
export type ComponentBlockWithUser = Prisma.ComponentBlockGetPayload<{ include: { user: true, versions: true } }>

export type ComponentBlockListItem = Pick<ComponentBlock, 'id' | 'name' | 'filePath' | 'createdAt' | 'updatedAt'> & {
  userId: string
  user: ComponentBlockUser
  versions: ComponentBlockVersion[]
}

export type ComponentBlockListResult = {
  componentBlocks: ComponentBlockListItem[]
  currentPage: number
  total: number
}
