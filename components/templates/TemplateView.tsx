'use client'
import { ChevronDown } from 'lucide-react'
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

const TemplateView = ({ lable = "For you", lists }: { lable?: string, lists: Array<any> }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    return (
        <motion.div className='flex flex-col gap-4'>
            <div
                className='flex gap-2 items-center text-default-500 cursor-pointer select-none'
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <p className='text-sm'>{ lable }</p>
                <motion.div
                    aria-hidden
                    animate={{ rotate: isExpanded ? 0 : 180 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                >
                    <ChevronDown size={16} className='text-default-500'/>
                </motion.div>
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
                            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4'>
                                TemplateView
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

export default TemplateView