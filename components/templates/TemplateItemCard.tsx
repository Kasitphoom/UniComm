'use client'
import { TemplateWithUser } from '@/types/template'
import { Card, CardBody, CardFooter, Skeleton, User } from '@heroui/react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import React from 'react'

const TemplateItemCard = ({ template }: { template: TemplateWithUser }) => {
    const router = useRouter()
    const pathname = usePathname()

    const onCardClick = () => {
        router.push(`${pathname}/${template.id}`)
    }

    return (
        <Card className='h-70' shadow='sm' isPressable onPress={onCardClick}>
            <CardBody>
                <Skeleton className='w-full h-full rounded-md'></Skeleton>
            </CardBody>
            <CardFooter className='flex flex-col gap-2 items-start justify-between'>
                <p className='line-clamp-2 text-ellipsis overflow-hidden'>{ template.title }</p>
                <User
                    name={ template.user.displayName }
                    avatarProps={{ 
                        name: template.user.displayName?.toUpperCase(),
                        size: 'sm'
                    }}
                />
            </CardFooter>
        </Card>
    )
}

export default TemplateItemCard