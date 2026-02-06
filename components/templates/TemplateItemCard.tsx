'use client'
import { deleteTemplate, fetchTemplates, fetchUserTemplates } from '@/features/templates/templatesSlice'
import { setSidebarOpen } from '@/features/ui/uiSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { TemplateListItem } from '@/types/template'
import { timeDifferenceFormatter } from '@/utils/DateFormatter'
import { Button, Card, CardBody, CardFooter, Dropdown, DropdownMenu, DropdownTrigger, DropdownItem, Skeleton, User, addToast, Spinner, cn, Chip } from '@heroui/react'
import { Clock, Dot, EllipsisVertical, FileText, TrashIcon } from 'lucide-react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import React, { Key, useEffect, useMemo, useState } from 'react'
import { clientFetchParsedTemplate } from '@/utils/template/utils'
import { generatePdfPreview } from './TemplateExportBar'
import { Template } from '@pdfme/common'
import { useUser } from '@/components/providers/UserProvider'
import { UserRole } from '@/app/generated/business/prisma'
import { canDeleteResource } from '@/utils/permissions'

const PdfViewer = dynamic(() => import('@/components/PdfViewer'), { 
    ssr: false,
    loading: () => <div className='w-full h-full flex justify-center items-center'><Spinner color='secondary'/></div>, 
})

const TemplateItemCard = ({ template }: { template: TemplateListItem }) => {
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

    // Check if user has permission to delete (owner of template OR system admin/owner)
    const isTemplateOwner = template.userId === currentUser.currentBusinessProfile?.id
    const canDelete = canDeleteResource(isTemplateOwner, currentUser.role)
    type ApprovalStatus = {
        status: 'Approved' | 'Rejected' | 'Awaiting Approval'
        color: 'success' | 'danger' | 'warning'
    }

    const approvedStatus = useMemo<ApprovalStatus | null>(() => {
        const approver = template.approvers?.find(a => a.userId === currentUser.currentBusinessProfile?.id)
        if (!approver) return null

        return {
            status: approver.status === 'APPROVED' ? 'Approved' : approver.status === 'REJECTED' ? 'Rejected' : 'Awaiting Approval',
            color: approver.status === 'APPROVED' ? 'success' : approver.status === 'REJECTED' ? 'danger' : 'warning',
        }
    }, [template.approvers])

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
                const parsedTemplate = await clientFetchParsedTemplate(template.id)
                setPreviewTemplate({
                    ...parsedTemplate,
                    schemas: [parsedTemplate.schemas[0]],
                })
                if (isCancelled) return

                const pdfBytes = await generatePdfPreview(parsedTemplate)
                if (isCancelled) return

                objectUrl = URL.createObjectURL(new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }))
                setPreviewUrl(objectUrl)
            } catch (error: any) {
                if (isCancelled) return
                console.error('Failed to load template preview:', error)
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
    }, [template.id, viewMode])

    const onCardClick = () => {
        router.push(`${pathname}/${template.id}`)
        dispatch(setSidebarOpen(false))
    }

    const onTemplateDelete = async () => {
        await dispatch(deleteTemplate(template.id))
        addToast({
            title: 'Template deleted',
            color: 'secondary',
            timeout: 3000,
        })
    }

    const onAction = async (key: Key) => {
        if (key === 'Delete') {
            await onTemplateDelete()
            dispatch(fetchUserTemplates({
                query: searchParams.get('query') || '',
            }))
            dispatch(fetchTemplates({
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
            <DropdownMenu onAction={onAction} aria-label="Template Actions">
                <DropdownItem 
                    key="Delete" 
                    color="danger" 
                    className="text-danger" 
                    startContent={<TrashIcon size={16} />}
                >
                    Delete Template
                </DropdownItem>
            </DropdownMenu>
        </Dropdown>
    );

    return (
        <Card 
            isPressable 
            onPress={onCardClick}
            className={cn(
                "group transition-all duration-300 shadow-none",
                viewMode === "grid" 
                    ? "border border-default-100 hover:border-secondary-300 hover:shadow-xl hover:shadow-default-200/50" 
                    : "hover:bg-default-100/50 border border-default-100 hover:border-secondary-300"
            )}
        >
            <CardBody className={cn("p-0 overflow-visible", viewMode === 'list' && "px-4 py-3")}>
                {viewMode === 'grid' ? (
                    <div className="relative w-full aspect-video overflow-hidden rounded-t-xl bg-default-50 border-b border-default-100">
                        {/* Status Badge Overlay */}
                        {template.requireUserApproval && (
                            <div className="absolute top-2 left-2 z-20">
                                <Chip 
                                    size="sm" 
                                    color={approvedStatus?.color || 'default'} 
                                    variant="shadow" 
                                    className="text-[10px] font-bold shadow-sm"
                                >
                                    {
                                        approvedStatus?.status
                                    }
                                </Chip>
                            </div>
                        )}

                        {/* Interactive Hover Overlay */}
                        <div className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/5 flex items-center justify-center backdrop-blur-[2px]">
                            <Button size="sm" variant="flat" className="bg-white/90 font-bold shadow-sm" onPress={onCardClick}>Edit Template</Button>
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
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="p-2 rounded-lg bg-secondary-50 text-secondary shrink-0">
                                <FileText size={18} />
                            </div>
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <p className="font-semibold text-small truncate">
                                    {template.title}
                                </p>
                                {/* Status Chip for List View */}
                                {template.requireUserApproval && (
                                    <Chip
                                        size="sm"
                                        color={approvedStatus?.color || 'default'}
                                        variant="flat"
                                        className="text-[10px] h-5 font-bold shrink-0"
                                    >
                                        {approvedStatus?.status}
                                    </Chip>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-6 shrink-0">
                            <User
                                name={template.user.displayName}
                                avatarProps={{
                                    name: template.user.displayName?.toUpperCase(),
                                    size: 'sm',
                                    className: "h-7 w-7 text-[10px] bg-secondary-100 text-secondary"
                                }}
                                classNames={{ name: "hidden md:block text-tiny font-medium" }}
                            />
                            <div className="hidden sm:flex items-center gap-1.5 text-default-400">
                                <Clock size={14} />
                                <p className="text-tiny whitespace-nowrap">
                                    {timeDifferenceFormatter(new Date(template.updatedAt))}
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
                            {template.title}
                        </h3>
                        {canDelete && <ActionMenu onAction={onAction} />}
                    </div>

                    <div className="flex items-center justify-between w-full border-t border-default-50 pt-3">
                        <User
                            name={template.user.displayName}
                            description={timeDifferenceFormatter(new Date(template.updatedAt))}
                            avatarProps={{ 
                                name: template.user.displayName?.toUpperCase(),
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

const LoadingTemplateItemCard = () => {
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

export default dynamic(() => Promise.resolve(TemplateItemCard), { ssr: false, loading: () => <LoadingTemplateItemCard /> })