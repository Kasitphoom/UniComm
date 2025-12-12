'use client'
import { Divider, User } from '@heroui/react'
import React from 'react'
import { useUser } from '@/components/providers/UserProvider'

const HeaderUserInner = () => {
  const user = useUser()

  if (user.loading) {
    return (
      <div className='flex gap-4 h-[40px]'>
        <div className='w-1 h-full border-l border-default-200 bg-default-200' />
        <div className='flex gap-2'>
          <div className='w-[40px] h-[40px] rounded-full animate-pulse bg-default-200' />
          <div className='flex flex-col gap-1 justify-center'>
            <div className='w-[70px] h-[15px] rounded-md animate-pulse bg-default-200' />
            <div className='w-[40px] h-[10px] rounded-md animate-pulse bg-default-200' />
          </div>
        </div>
      </div>
    )
  }

  const displayName = user.currentBusinessProfile?.displayName || user.email || 'User'
  const description = user.currentBusinessProfile?.role || undefined

  return (
    <div className='flex gap-4 h-[40px]'>
      <Divider orientation='vertical' />
      <User
        name={displayName}
        avatarProps={{ name: displayName?.toUpperCase() || 'U' }}
        description={description}
      />
    </div>
  )
}

export default HeaderUserInner
