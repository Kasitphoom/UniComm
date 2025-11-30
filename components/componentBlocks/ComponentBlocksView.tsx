'use client'
import React, { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { Pagination, Spinner } from '@heroui/react'
import { fetchComponentBlocks } from '@/features/componentBlocks/componentBlocksSlice'
import { useSearchParams, useRouter } from 'next/navigation'
import ComponentBlockCard from './ComponentBlockCard'

interface ComponentBlocksViewProps {
    label?: string
}

const ComponentBlocksView = ({ label = 'Component Blocks' }: ComponentBlocksViewProps) => {
    const dispatch = useAppDispatch()
    const searchParams = useSearchParams()
    const router = useRouter()
    const [isExpanded, setIsExpanded] = useState(true)
    const viewMode = useAppSelector(state => state.ui.viewMode)

    const { status, items, currentPage, totalPages } = useAppSelector(state => state.componentBlocks.list)

    useEffect(() => {
        dispatch(fetchComponentBlocks({
            query: searchParams.get('query') || '',
            page: searchParams.get('page') ? parseInt(searchParams.get('page') as string, 10) : 1,
        }))
    }, [dispatch, searchParams])

    const onPageChange = (page: number) => {
        const params = new URLSearchParams(searchParams.toString())

        params.set('page', page.toString())

        const qs = params.toString()
        const url = qs ? `?${qs}` : ''
        
        router.push(url)
    }

    console.log(currentPage)

    return (
        <motion.div className='flex flex-col gap-4'>
            <div className='flex'>
                <div
                    className='flex gap-2 items-center text-default-500 cursor-pointer select-none'
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <p className='text-sm'>{label}</p>
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
                        key='component-blocks-content'
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className='overflow-hidden'
                    >
                        {status === 'loading' ? (
                            <div className='text-center text-default-500 py-8'>
                                <Spinner color='secondary' />
                            </div>
                        ) : items.length === 0 ? (
                            <div className='text-center text-default-500 py-8'>No component blocks to display.</div>
                        ) : (
                            <div className={`grid grid-cols-1 ${viewMode === 'grid' ? " md:grid-cols-2 lg:grid-cols-4" : ""}  py-4 gap-4`}>
                                {
                                    items.map(block => (
                                        <ComponentBlockCard key={block.id} block={block} />
                                    ))
                                }
                            </div>
                        )}
                        <div className='flex justify-center'>
                            <Pagination
                                color="secondary"
                                page={currentPage}
                                total={totalPages}
                                onChange={onPageChange}
                                classNames={{
                                    item: 'bg-white',
                                }}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

export default ComponentBlocksView