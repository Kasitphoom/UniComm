'use client'
import { deleteTemplate } from '@/features/templates/templatesSlice'
import { setSidebarOpen } from '@/features/ui/uiSlice'
import { useAppDispatch } from '@/store/hooks'
import { TemplateWithUser } from '@/types/template'
import { timeDifferenceFormatter } from '@/utils/DateFormatter'
import { Button, Card, CardBody, CardFooter, Dropdown, DropdownMenu, DropdownTrigger, DropdownItem, Skeleton, User, addToast } from '@heroui/react'
import { Dot, EllipsisVertical, TrashIcon } from 'lucide-react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import React, { Key } from 'react'

const TemplateItemCard = ({ template }: { template: TemplateWithUser }) => {
    const dispatch = useAppDispatch()
    const router = useRouter()
    const pathname = usePathname()

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

    const onAction = (key: Key) => {
        if (key === 'Delete') {
            onTemplateDelete()
        }
    }

    return (
        <Card className='h-70' shadow='sm' isPressable onPress={onCardClick}>
            <CardBody>
                <Skeleton className='w-full h-full rounded-md'></Skeleton>
            </CardBody>
            <CardFooter className='relative flex flex-col gap-2 items-start justify-between'>
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
            </CardFooter>
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