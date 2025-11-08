'use client'
import { setSidebarOpen } from '@/features/ui/uiSlice'
import { useAppDispatch } from '@/store/hooks'
import { TemplateWithUser } from '@/types/template'
import { Card, CardBody, CardFooter, Skeleton, User } from '@heroui/react'
import { Dot } from 'lucide-react'
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

    return (
        <Card className='h-70' shadow='sm' isPressable onPress={onCardClick}>
            <CardBody>
                <Skeleton className='w-full h-full rounded-md'></Skeleton>
            </CardBody>
            <CardFooter className='flex flex-col gap-2 items-start justify-between'>
                <p className='line-clamp-2 text-ellipsis overflow-hidden'>{ template.title }</p>
                <div className='flex gap-2 items-center'>
                    <User
                        name={ template.user.displayName }
                        avatarProps={{ 
                            name: template.user.displayName?.toUpperCase(),
                            size: 'sm'
                        }}
                    />
                    <Dot size={12} className='text-default-400' />
                    <p className='text-xs text-default-400'>{ new Date(template.updatedAt).toLocaleDateString() }</p>
                </div>
            </CardFooter>
        </Card>
    )
}

export default TemplateItemCard