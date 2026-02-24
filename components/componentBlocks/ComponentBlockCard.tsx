'use client'
import React, { Key, useEffect, useState } from 'react'
import { Button, Card, CardBody, CardFooter, Dropdown, DropdownMenu, DropdownTrigger, DropdownItem, Skeleton, User, Spinner, addToast, cn } from '@heroui/react'
import { Clock, EllipsisVertical, FileText, TrashIcon } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { timeDifferenceFormatter } from '@/utils/DateFormatter'
import type { ComponentBlockWithUser } from '@/types/componentBlock'
import { deleteComponentBlock, fetchComponentBlocks } from '@/features/componentBlocks/componentBlocksSlice'
import { setSidebarOpen } from '@/features/ui/uiSlice'
import { Template } from '@pdfme/common'
import { clientFetchParsedComponentBlock } from '@/utils/template/utils'
import { useUser } from '@/components/providers/UserProvider'
import { UserRole } from '@/app/generated/business/prisma'
import { canDeleteResource } from '@/utils/permissions'

const PdfViewer = dynamic(() => import('@/components/PdfViewer'), { 
    ssr: false,
    loading: () => <div className='w-full h-full flex justify-center items-center'><Spinner color='secondary'/></div>, 
})

const ComponentBlockCard = ({ block }: { block: ComponentBlockWithUser }) => {
	const dispatch = useAppDispatch()
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const viewMode = useAppSelector(state => state.ui.viewMode)
	const currentUser = useUser()
	const [previewUrl, setPreviewUrl] = useState<string | null>(null)
	const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)
	const [isPreviewLoading, setIsPreviewLoading] = useState(false)
	const [previewError, setPreviewError] = useState<string | null>(null)

	// Check if user has permission to delete (owner of component OR system admin/owner)
	const isComponentOwner = block.userId === currentUser.currentBusinessProfile?.id
	const canDelete = canDeleteResource(isComponentOwner, currentUser.role)

	useEffect(() => {
		if (viewMode !== 'grid') return

		let isCancelled = false
		let objectUrl: string | null = null

		const loadPreview = async () => {
			setIsPreviewLoading(true)
			setPreviewError(null)
			setPreviewUrl(null)
			setPreviewTemplate(null)

			try {
				// Parse component block data as template
				const parsedTemplate = await clientFetchParsedComponentBlock(block.id)
				setPreviewTemplate({
					...parsedTemplate,
					schemas: [parsedTemplate.schemas[0]],
				})
				if (isCancelled) return

				// Generate PDF preview
				const { generatePdfPreview } = await import('@/components/templates/TemplateExportBar')
				const pdfBytes = await generatePdfPreview(parsedTemplate)
				if (isCancelled) return

				objectUrl = URL.createObjectURL(new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }))
				setPreviewUrl(objectUrl)
			} catch (error: any) {
				if (isCancelled) return
				console.error('Failed to load component block preview:', error)
				setPreviewError(error?.message || 'Failed to load preview')
			} finally {
				if (!isCancelled) {
					setIsPreviewLoading(false)
				}
			}
		}

		loadPreview()

		return () => {
			isCancelled = true
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl)
			}
		}
	}, [block.id, viewMode])

	const onCardClick = () => {
		router.push(`${pathname}/${block.id}`)
		dispatch(setSidebarOpen(false))
	}

	const onBlockDelete = async () => {
		await dispatch(deleteComponentBlock(block.id))
		addToast({
			title: 'Component block deleted',
			color: 'secondary',
			timeout: 3000,
		})
	}

	const onAction = async (key: Key) => {
		if (key === 'Delete') {
			await onBlockDelete()
			dispatch(fetchComponentBlocks({
				query: searchParams.get('query') || '',
				page: searchParams.get('page') ? parseInt(searchParams.get('page') as string, 10) : 1,
			}))
		}
	}

	const ActionMenu = ({ onAction } : { onAction: (key: Key) => Promise<void> }) => (
		<Dropdown placement="bottom-end">
			<DropdownTrigger>
				<Button isIconOnly size="sm" variant="light" className="text-default-400 min-w-unit-8 w-8 h-8">
					<EllipsisVertical size={16} />
				</Button>
			</DropdownTrigger>
			<DropdownMenu onAction={onAction} aria-label="Component Actions">
				<DropdownItem 
					key="Delete" 
					color="danger" 
					className="text-danger" 
					startContent={<TrashIcon size={16} />}
				>
					Delete Component
				</DropdownItem>
			</DropdownMenu>
		</Dropdown>
	)

	return (
		<Card 
			isPressable
			onPress={onCardClick}
			className={cn(
				"group transition-all duration-300",
				viewMode === "grid" 
					? "border border-default-100 hover:border-secondary-300 shadow-none hover:shadow-xl hover:shadow-default-200/50" 
					: "border-none hover:bg-default-100/50"
			)}
		>
			<CardBody className={cn("p-0 overflow-visible", viewMode === 'list' && "px-4 py-3")}>
				{viewMode === 'grid' ? (
					<div className="relative w-full aspect-video overflow-hidden rounded-t-xl bg-default-50 border-b border-default-100">
						{/* Interactive Hover Overlay */}
						<div className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/5 flex items-center justify-center backdrop-blur-[2px]">
							<Button size="sm" variant="flat" className="bg-white/90 font-bold shadow-sm" onPress={onCardClick}>Edit Component</Button>
						</div>

						{isPreviewLoading && (
							<Skeleton className="w-full h-full" />
						)}
						
						{previewTemplate ? (
							<div className="w-full h-full pointer-events-none origin-top scale-[1.01]">
								<PdfViewer 
									template={previewTemplate} 
									className="w-full h-full object-cover" 
									customViewerOptions={{ showToolbar: false, scroll: false }}
								/>
							</div>
						) : (!isPreviewLoading && (
							<div className="flex flex-col items-center justify-center h-full text-default-300 gap-2">
								<FileText size={28} strokeWidth={1.5} />
								<span className="text-[10px] font-bold uppercase tracking-widest text-default-400">
									{previewError || 'Preview Unavailable'}
								</span>
							</div>
						))}
					</div>
				) : (
					/* --- LIST VIEW ROW --- */
					<div className="flex items-center justify-between w-full gap-4">
						<div className="flex items-center gap-4 flex-1">
							<div className="p-2 rounded-lg bg-secondary-50 text-secondary">
								<FileText size={18} />
							</div>
							<p className="font-semibold text-small line-clamp-1 truncate flex-1">
								{block.name}
							</p>
						</div>

						<div className="flex items-center gap-6">
							<User
								name={block.user.displayName}
								avatarProps={{ 
									name: block.user.displayName?.toUpperCase(),
									size: 'sm',
									className: "h-7 w-7 text-[10px] bg-secondary-100 text-secondary"
								}}
								classNames={{ name: "hidden md:block text-tiny font-medium" }}
							/>
							<div className="hidden sm:flex items-center gap-1.5 text-default-400">
								<Clock size={14} />
								<p className="text-tiny whitespace-nowrap">
									{timeDifferenceFormatter(new Date(block.updatedAt))}
								</p>
							</div>
							{canDelete && (
								<ActionMenu onAction={onAction} />
							)}
						</div>
					</div>
				)}
			</CardBody>

			{viewMode === 'grid' && (
				<CardFooter className="flex flex-col items-start gap-3 p-4">
					<div className="flex justify-between items-start w-full gap-2">
						<h3 className="text-small text-left font-bold leading-tight line-clamp-2 min-h-10 flex-1">
							{block.name}
						</h3>
						{canDelete && <ActionMenu onAction={onAction} />}
					</div>

					<div className="flex items-center justify-between w-full border-t border-default-50 pt-3">
						<User
							name={block.user.displayName}
							description={timeDifferenceFormatter(new Date(block.updatedAt))}
							avatarProps={{ 
								name: block.user.displayName?.toUpperCase(),
								size: 'sm',
								className: "h-6 w-6 text-[10px]"
							}}
							classNames={{
								name: "text-[11px] font-semibold leading-none",
								description: "text-[10px] text-default-400 mt-0.5"
							}}
						/>
					</div>
				</CardFooter>
			)}
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
