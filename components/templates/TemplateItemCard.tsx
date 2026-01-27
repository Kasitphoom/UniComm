'use client'
import { deleteTemplate, fetchTemplates, fetchUserTemplates } from '@/features/templates/templatesSlice'
import { setSidebarOpen } from '@/features/ui/uiSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { TemplateListItem } from '@/types/template'
import { timeDifferenceFormatter } from '@/utils/DateFormatter'
import { Button, Card, CardBody, CardFooter, Dropdown, DropdownMenu, DropdownTrigger, DropdownItem, Skeleton, User, addToast, Spinner } from '@heroui/react'
import { Dot, EllipsisVertical, TrashIcon } from 'lucide-react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import React, { Key, useEffect, useState } from 'react'
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

    return (
        <Card className={viewMode === "grid" ? 'h-70' : ""} shadow={viewMode === "grid" ? 'sm' : "none"} isPressable onPress={onCardClick}>
            <CardBody>
                {
                    viewMode === 'grid' ? (
                        <div className='w-full h-full overflow-hidden rounded-md bg-default-100'>
                            {isPreviewLoading && !previewUrl && (
                                <Skeleton className='w-full h-full rounded-md' />
                            )}
                            {previewTemplate ? (
                                <PdfViewer template={previewTemplate} className={'overflow-hidden w-full h-full rounded-md'} customViewerOptions={{ showToolbar: false, scroll: false }} />
                            ) : (!isPreviewLoading && (
                                <div className='flex items-center justify-center text-xs text-default-400'>
                                    {previewError || 'Preview unavailable'}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className='flex items-center justify-between w-full'>
                            <p className='line-clamp-2 text-ellipsis overflow-hidden'>{ template.title }</p>
                            <div className='flex md:gap-2 items-center flex-wrap'>
                                <User
                                    name={ template.user.displayName }
                                    avatarProps={{ 
                                        name: template.user.displayName?.toUpperCase(),
                                        size: 'sm',
                                        className: "h-6 w-6 text-[10px]"
                                    }}
                                    classNames={{
                                        name: "hidden md:inline-block",
                                    }}
                                />
                                <Dot size={12} className='hidden md:block text-default-400' />
                                <p className='text-xs text-default-400' suppressHydrationWarning>
                                    { timeDifferenceFormatter(new Date(template.updatedAt)) }
                                </p>
                            </div>
                        </div>
                    ) 
                }
            </CardBody>
            {
                viewMode === 'grid' && (
                    <CardFooter className='relative flex shrink-0 flex-col gap-2 items-start justify-between'>
                        <p className='line-clamp-2 text-ellipsis overflow-hidden'>{ template.title }</p>
                        <div className='flex gap-2 items-center flex-wrap'>
                            <User
                                name={ template.user.displayName }
                                avatarProps={{ 
                                    name: template.user.displayName?.toUpperCase(),
                                    size: 'sm'
                                }}
                            />
                            <Dot size={12} className='text-default-400' />
                            <p className='text-xs text-default-400' suppressHydrationWarning>
                                { timeDifferenceFormatter(new Date(template.updatedAt)) }
                            </p>
                        </div>
                        {canDelete && (
                            <Dropdown>
                                <DropdownTrigger>
                                    <div className='absolute top-2 right-2 w-fit hover:cursor-pointer hover:bg-default-200 p-2 rounded-full transition-background'>
                                        <EllipsisVertical size={16} />
                                    </div>
                                </DropdownTrigger>
                                <DropdownMenu onAction={onAction}>
                                    <DropdownItem key="Delete" color="danger" className='text-danger' startContent={<TrashIcon size={16} />}>
                                        Delete
                                    </DropdownItem>
                                </DropdownMenu>
                            </Dropdown>
                        )}
                    </CardFooter>
                )
            }
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