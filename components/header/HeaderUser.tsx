"use client"
import dynamic from 'next/dynamic'
import React from 'react'

const LoadingSkeleton = () => (
    <div className='flex gap-4 h-10'>
        <div className='w-1 h-full border-l border-default-200 bg-default-200' />
        <div className='flex gap-2'>
            <div className='w-10 h-10 rounded-full animate-pulse bg-default-200' />
            <div className='flex flex-col gap-1 justify-center'>
                <div className='w-17.5 h-3.75 rounded-md animate-pulse bg-default-200' />
                <div className='w-10 h-2.5 rounded-md animate-pulse bg-default-200' />
            </div>
        </div>
    </div>
)

const HeaderUser = dynamic(() => import('./HeaderUserInner'), {
    ssr: false,
    loading: () => <LoadingSkeleton />,
})

export default HeaderUser