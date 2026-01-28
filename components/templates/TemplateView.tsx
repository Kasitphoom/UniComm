'use client'
import { ChevronDown } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { cn, Pagination, Spinner } from '@heroui/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import TemplateItemCard from './TemplateItemCard'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchTemplates, fetchUserTemplates } from '@/features/templates/templatesSlice'

const TemplateView = ({
    lable = "For you",
    userOnly = false,
}: {
    lable?: string,
    userOnly?: boolean,
}) => {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const viewMode = useAppSelector(state => state.ui.viewMode);

    const { 
        items: allTemplateList, 
        status: allStatus, 
        currentPage: allCurrentPage, 
        totalPages: allTotalPage 
    } = useAppSelector(state => state.templates.list)
    const { 
        items: userList, 
        status: userStatus, 
        currentPage: userCurrentPage, 
        totalPages: userTotalPages 
    } = useAppSelector(state => state.templates.user.list)
    const lists = userOnly ? userList : allTemplateList;
    const status = userOnly ? userStatus : allStatus;
    const currentPage = userOnly ? userCurrentPage : allCurrentPage;
    const totalPages = userOnly ? userTotalPages : allTotalPage;

    const [isExpanded, setIsExpanded] = useState(true);

    const onPageChange = (page: number) => {
        // change current query page to `page`
        const params = new URLSearchParams(searchParams.toString())

        params.set('page', page.toString())

        const qs = params.toString()
        const url = qs ? `${pathname}?${qs}` : pathname
        router.push(url)
    }

    useEffect(() => {
        const page = searchParams.get('page');
        const query = searchParams.get('query');

        if (userOnly) {
            dispatch(fetchUserTemplates({
                query: query || '',
            }))
        } else {
            dispatch(fetchTemplates({
                query: query || '',
                page: page ? parseInt(page) : 1,
                userOnly: userOnly,
            }))
        }

    }, [searchParams])

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
                        ) : status === "loading" ? (
                            <div className='text-center text-default-500 py-8'>
                                <Spinner size="md" color="secondary" />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-8 w-full">
                                <div className={cn(
                                    "grid gap-6 py-4",
                                    viewMode === 'grid' 
                                        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
                                        : "grid-cols-1"
                                )}>
                                    {lists.map((template) => (
                                        <TemplateItemCard 
                                            key={template.id} 
                                            template={template}
                                        />
                                    ))}
                                </div>

                                {/* Pagination Section */}
                                {!userOnly && totalPages > 1 && (
                                    <div className="flex justify-center border-t border-default-100 pt-8">
                                        <Pagination
                                            isCompact
                                            showControls
                                            color="secondary"
                                            page={currentPage}
                                            total={totalPages}
                                            onChange={onPageChange}
                                            classNames={{
                                                cursor: "bg-[#7828C8] shadow-lg shadow-secondary/20",
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

export default TemplateView