'use client'
import { ChevronDown } from 'lucide-react'
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Pagination } from '@heroui/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const TemplateView = ({ 
    lable = "For you", 
    lists, 
    total, 
    currentPage 
}: {
    lable?: string, 
    lists: Array<any>, 
    total?: number, 
    currentPage?: number 
}) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isExpanded, setIsExpanded] = useState(true);

    const onPageChange = (page: number) => {
        // change current query page to `page`
        const params = new URLSearchParams(searchParams.toString())

        params.set('page', page.toString())
        
        const qs = params.toString()
        const url = qs ? `${pathname}?${qs}` : pathname
        router.push(url)
    }

    return (
        <motion.div className='flex flex-col gap-4'>
            <div className='flex'>
                <div
                    className='flex gap-2 items-center text-default-500 cursor-pointer select-none'
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <p className='text-sm'>{lable}</p>
                    <motion.div
                        aria-hidden
                        animate={{ rotate: isExpanded ? 0 : 180 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                    >
                        <ChevronDown size={16} className='text-default-500' />
                    </motion.div>
                </div>
            </div>

            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        key="template-content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className='overflow-hidden'
                    >
                        {(!Array.isArray(lists) || lists.length === 0) ? (
                            <div className='text-center text-default-500 py-8'>
                                No items to display.
                            </div>
                        ) : (
                            <div className='flex flex-col gap-4'>
                                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4'>
                                    TemplateView
                                </div>
                                {
                                    total && currentPage && (
                                        <Pagination color="secondary" page={currentPage} total={total} onChange={onPageChange} />
                                    )
                                }
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

export default TemplateView