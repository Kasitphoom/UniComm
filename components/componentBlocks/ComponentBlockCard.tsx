'use client'
import React from 'react'
import { Card, CardBody, CardFooter, Dropdown, DropdownMenu, DropdownTrigger, DropdownItem, Skeleton, User } from '@heroui/react'
import { ChevronDown, Dot, EllipsisVertical } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAppSelector } from '@/store/hooks'
import { timeDifferenceFormatter } from '@/utils/DateFormatter'
import type { ComponentBlockWithUser } from '@/types/componentBlock'

const ComponentBlockCard = ({ block }: { block: ComponentBlockWithUser }) => {
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const viewMode = useAppSelector(state => state.ui.viewMode)

	const onCardClick = () => {
		router.push(`${pathname}/${block.id}`)
	}

	const onAction = async (key: any) => {
		// Placeholder for actions (e.g., delete, rename)
		// Implement thunk actions similar to templates when backend is ready
	}

	return (
		<Card className={viewMode === 'grid' ? 'h-70' : ''} shadow={viewMode === 'grid' ? 'sm' : 'none'} isPressable onPress={onCardClick}>
			<CardBody>
				{
					viewMode === 'grid' ? (
						<Skeleton className='w-full h-full rounded-md'></Skeleton>
					) : (
						<div className='flex items-center justify-between w-full'>
							<p className='line-clamp-2 text-ellipsis overflow-hidden'>{block.name}</p>
							<div className='flex gap-2 items-center flex-wrap'>
								<User
									name={block.user.displayName}
									avatarProps={{
										name: block.user.displayName?.toUpperCase(),
										size: 'sm',
										className: 'h-6 w-6 text-[10px]'
									}}
								/>
								<Dot size={12} className='text-default-400' />
								<p className='text-xs text-default-400' suppressHydrationWarning>
									{timeDifferenceFormatter(new Date(block.updatedAt))}
								</p>
							</div>
						</div>
					)
				}
			</CardBody>
			{
				viewMode === 'grid' && (
					<CardFooter className='relative flex flex-col gap-2 items-start justify-between'>
						<p className='line-clamp-2 text-ellipsis overflow-hidden'>{block.name}</p>
						<div className='flex gap-2 items-center flex-wrap'>
							<User
								name={block.user.displayName}
								avatarProps={{
									name: block.user.displayName?.toUpperCase(),
									size: 'sm'
								}}
							/>
							<Dot size={12} className='text-default-400' />
							<p className='text-xs text-default-400' suppressHydrationWarning>
								{timeDifferenceFormatter(new Date(block.updatedAt))}
							</p>
						</div>
						<Dropdown>
							<DropdownTrigger>
								<div className='absolute top-2 right-2 w-fit hover:cursor-pointer hover:bg-default-200 p-2 rounded-full transition-background'>
									<EllipsisVertical size={16} />
								</div>
							</DropdownTrigger>
							<DropdownMenu onAction={onAction}>
								<DropdownItem key='Options'>Options</DropdownItem>
							</DropdownMenu>
						</Dropdown>
					</CardFooter>
				)
			}
		</Card>
	)
}

const LoadingComponentBlockCard = () => {
	return (
		<Card className='h-70' shadow='sm'>
			<CardBody>
				<Skeleton className='w-full h-full rounded-md'></Skeleton>
			</CardBody>
			<CardFooter className='flex flex-col gap-2 items-start justify-between'>
				<Skeleton className='w-full h-6 rounded-md'></Skeleton>
				<Skeleton className='w-full h-8 rounded-md'></Skeleton>
			</CardFooter>
		</Card>
	)
}

export default dynamic(() => Promise.resolve(ComponentBlockCard), { ssr: false, loading: () => <LoadingComponentBlockCard /> })
