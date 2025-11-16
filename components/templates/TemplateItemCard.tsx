'use client'
import { deleteTemplate } from '@/features/templates/templatesSlice'
import { setSidebarOpen } from '@/features/ui/uiSlice'
import { useAppDispatch } from '@/store/hooks'
import { TemplateWithUser } from '@/types/template'
import { timeDifferenceFormatter } from '@/utils/DateFormatter'
import { Button, Card, CardBody, CardFooter, Dropdown, DropdownMenu, DropdownTrigger, DropdownItem, Skeleton, User } from '@heroui/react'
import { Dot, EllipsisVertical, TrashIcon } from 'lucide-react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import React from 'react'

const TemplateItemCard = ({ template }: { template: TemplateWithUser }) => {
    const dispatch = useAppDispatch()
    const router = useRouter()
    const pathname = usePathname()

    const onCardClick = () => {
        router.push(`${pathname}/${template.id}`)
        dispatch(setSidebarOpen(false))
    }

    const onTemplateDelete = async (e: React.MouseEvent) => {
        await dispatch(deleteTemplate(template.id))
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
                    <p className='text-xs text-default-400'>{ timeDifferenceFormatter(new Date(template.updatedAt)) }</p>
                </div>
                <Dropdown>
                    <DropdownTrigger>
                        <Button size='sm' radius='full' variant='light' className='absolute top-2 right-2 w-fit'>
                            <EllipsisVertical size={16} />
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu>
                        <DropdownItem key="Delete" color="danger" className='text-danger' startContent={<TrashIcon size={16} />}>
                            Delete
                        </DropdownItem>
                    </DropdownMenu>
                </Dropdown>
            </CardFooter>
        </Card>
    )
}

export default TemplateItemCard