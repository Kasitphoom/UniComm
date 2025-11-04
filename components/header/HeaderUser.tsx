"use client"
import dynamic from 'next/dynamic'
import React from 'react'

const LoadingSkeleton = () => (
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

const HeaderUser = dynamic(() => import('./HeaderUserInner'), {
    ssr: false,
    loading: () => <LoadingSkeleton />,
})

export default HeaderUser