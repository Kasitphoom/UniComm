'use client'
import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useAppSelector } from '@/store/hooks'

interface ComponentBlocksViewProps {
    label?: string
}

const ComponentBlocksView = ({ label = 'Component Blocks' }: ComponentBlocksViewProps) => {
    const [isExpanded, setIsExpanded] = useState(true)
    const viewMode = useAppSelector(state => state.ui.viewMode)

    // Placeholder data; integrate with Redux / API later
    const blocks: any[] = []
    const status: 'idle' | 'loading' | 'error' = 'idle'

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
                        {false ? ( // status === 'loading'
                            <div className='text-center text-default-500 py-8'>Loading...</div>
                        ) : blocks.length === 0 ? (
                            <div className='text-center text-default-500 py-8'>No component blocks to display.</div>
                        ) : (
                            <div className={`grid grid-cols-1 ${viewMode === 'grid' ? " md:grid-cols-2 lg:grid-cols-4" : ""}  py-4 gap-4`}>
                                {/* Map block cards here */}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

export default ComponentBlocksView