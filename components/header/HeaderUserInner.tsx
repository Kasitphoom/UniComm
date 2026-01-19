'use client'
import { Divider, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, User } from '@heroui/react'
import React from 'react'
import { useUser } from '@/components/providers/UserProvider'
import { signOut } from 'next-auth/react'

const HeaderUserInner = () => {
  const user = useUser()

  const onLogout = async () => {
    await signOut({ callbackUrl: '/' })
  }

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
      <Dropdown placement='bottom-end'>
        <DropdownTrigger>
          <User
            name={displayName}
            avatarProps={{ name: displayName?.toUpperCase() || 'U' }}
            description={description}
            classNames={{
              name: 'hidden sm:inline',
              description: 'hidden sm:inline',
            }}
          />
        </DropdownTrigger>
        <DropdownMenu aria-label="User menu" onAction={(key) => key === 'logout' && onLogout()}>
          <DropdownItem key="logout" color="danger">
            Logout
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </div>
  )
}

export default HeaderUserInner
