'use client'
import React, { useState, useEffect, useCallback, Key } from 'react'
import {
    Alert,
    Button,
    ButtonGroup,
    Popover,
    PopoverTrigger,
    PopoverContent,
    User,
    Input,
    Chip,
    Spinner,
    Divider,
    ScrollShadow,
    AlertProps,
    Badge,
    BadgeProps
} from '@heroui/react'
import { useInfiniteScroll } from "@heroui/use-infinite-scroll"
import {
    EyeIcon,
    History,
    Settings,
    Send,
    ChevronDown,
    Search
} from 'lucide-react'
import ExportButton, { ExportType } from './ExportButton'
import { Approver, BusinessUser } from '@/app/generated/business/prisma'
import { updateTemplateApprovers } from '@/features/templates/templatesSlice'

interface ApiResponse {
    users: BusinessUser[];
    currentPage: number;
    total: number; // Total number of PAGES
}

type SelectedUser = {
    userId: string;
    user: BusinessUser;
}

type submitApprovalButtonConfig = {
    disabled?: boolean;
    currentApprovers?: Approver[];
}

// =========================================================================
// 🚀 TODO: REPLACE THIS FUNCTION WITH YOUR REAL API CALL
// =========================================================================
const fetchUsers = async (page: number, query: string, perPage = 8): Promise<ApiResponse> => {
    
    const searchParams = new URLSearchParams({
        page: page.toString(),
        perPage: perPage.toString(),
        query: query || "", // Sends empty string if query is null
    });

    const response = await fetch(`/api/business/users?${searchParams.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Error fetching users: ${response.statusText}`);
    }

    const data = await response.json() as {
        users: BusinessUser[];
        currentPage: number;
        totalPage: number;
    };
    
    // Ensure your backend returns exactly this shape, or map it here:
    return {
        users: data.users,
        currentPage: data.currentPage,
        total: data.totalPage
    };
}

// --- 2. COMPONENT ---

const SubmitApprovalButton = ({ onSubmit, config }: { onSubmit?: (ids: string[]) => void, config: submitApprovalButtonConfig }) => {
    const [isOpen, setIsOpen] = useState(false)
    
    // Data State
    const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([])
    const [items, setItems] = useState<BusinessUser[]>([])
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [isLoading, setIsLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Derived state for the hook
    const hasMore = page < totalPages

    // 1. Fetch Logic
    const loadData = useCallback(async (pageNum: number, query: string) => {
        setIsLoading(true)
        try {
            // Call the API function defined above
            const res = await fetchUsers(pageNum, query, 8) 
            
            if (pageNum === 1) {
                setItems(res.users)
            } else {
                setItems(prev => [...prev, ...res.users])
            }
            
            setPage(res.currentPage)
            setTotalPages(res.total)
        } catch (e) {
            console.error(e)
        } finally {
            setIsLoading(false)
        }
    }, [])

    // 2. Initialize selectedUsers from currentApprovers and fetched users
    useEffect(() => {
        if (!config?.currentApprovers || items.length === 0) return

        const mappedUsers = config.currentApprovers
            .map(approver => {
                const user = items.find(u => u.id === approver.userId)
                if (user) {
                    return { userId: approver.userId, user }
                }
                return null
            })
            .filter((item): item is SelectedUser => item !== null)

        setSelectedUsers(mappedUsers)
    }, [items, config?.currentApprovers])

    // 3. Initial Load / Search Reset
    useEffect(() => {
        if (!isOpen) return

        // Debounce search to avoid spamming API while typing
        const timer = setTimeout(() => {
            setPage(1) 
            loadData(1, searchQuery) 
        }, 300)

        return () => clearTimeout(timer)
    }, [isOpen, searchQuery, loadData])

    // 4. HeroUI Infinite Scroll Hook
    const [, scrollerRef] = useInfiniteScroll({
        hasMore,
        isEnabled: isOpen, // Only run logic when open
        shouldUseLoader: false, // We control the loader UI manually
        onLoadMore: () => {
            if (!isLoading) {
                const nextPage = page + 1
                loadData(nextPage, searchQuery)
            }
        },
    })

    // -- Handlers --

    const handleSelect = (user: BusinessUser) => {
        if (!selectedUsers.find(s => s.userId === user.id)) {
            setSelectedUsers(prev => [...prev, { userId: user.id, user }])
        }
    }

    const handleRemove = (userId: string) => {
        setSelectedUsers(prev => prev.filter(u => u.userId !== userId))
    }

    const handleSubmit = async () => {
        setIsSubmitting(true)
        if (onSubmit) onSubmit(selectedUsers.map(u => u.userId))
        setIsSubmitting(false)
        setIsOpen(false)
        setSelectedUsers([])
        setSearchQuery("")
    }

    const visibleItems = items.filter(item => !selectedUsers.find(sel => sel.userId === item.id))

    return (
        <Popover
            placement="bottom-end"
            showArrow
            isOpen={isOpen}
            onOpenChange={setIsOpen}
            shouldCloseOnInteractOutside={() => true}
            offset={10}
        >
            <PopoverTrigger>
                <Button
                    color="secondary"
                    variant="solid"
                    endContent={<ChevronDown size={16} />}
                    className="font-medium"
                    isDisabled={config?.disabled}
                >
                    Submit Approval
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-85 p-0 overflow-hidden">
                {/* Header */}
                <div className="p-4 w-full bg-white">
                    <div className="mb-2 font-semibold text-small text-default-600">
                        Select BusinessUsers
                    </div>

                    {/* Chips */}
                    {selectedUsers.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {selectedUsers.map(selected => (
                                <Chip
                                    key={selected.userId}
                                    onClose={() => handleRemove(selected.userId)}
                                    variant="flat"
                                    color="secondary"
                                    size="sm"
                                >
                                    {selected.user.displayName}
                                </Chip>
                            ))}
                        </div>
                    )}

                    {/* Search Input */}
                    <Input
                        placeholder="Search..."
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                        startContent={<Search size={16} className="text-default-400" />}
                        variant="bordered"
                        color="secondary"
                        size="sm"
                        isClearable
                        onClear={() => setSearchQuery("")}
                        classNames={{ inputWrapper: "shadow-none border-default-200" }}
                    />
                </div>

                <Divider />

                {/* SCROLLABLE LIST */}
                <ScrollShadow 
                    className="max-h-60 w-full overflow-y-auto"
                    ref={scrollerRef} // Attach Ref for infinite scroll detection
                >
                    {visibleItems.length > 0 ? (
                        <div className="p-2 flex flex-col gap-1">
                            {visibleItems.map((user) => (
                                <button
                                    key={user.id}
                                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-secondary-50 transition-colors text-left cursor-pointer group"
                                    onClick={() => handleSelect(user)}
                                >
                                    <User
                                        name={user.displayName}
                                        description={user.email}
                                        avatarProps={{
                                            name: user.displayName,
                                            size: "sm",
                                            isBordered: false
                                        }}
                                        classNames={{
                                            name: "text-small font-medium group-hover:text-secondary-600",
                                            description: "text-tiny text-default-400"
                                        }}
                                    />
                                    <div className="text-secondary font-medium text-tiny opacity-0 group-hover:opacity-100 px-2">
                                        Add
                                    </div>
                                </button>
                            ))}
                            
                            {/* Loader Ref - Trigger for Infinite Scroll */}
                            {hasMore && (
                                <div className="w-full flex justify-center py-3">
                                    <Spinner size="sm" color="secondary" />
                                </div>
                            )}
                        </div>
                    ) : (
                        !isLoading && (
                            <div className="p-6 text-center text-tiny text-default-400">
                                {searchQuery ? "No results found" : "No users available"}
                            </div>
                        )
                    )}
                    
                    {/* Initial Loading State */}
                    {isLoading && items.length === 0 && (
                        <div className="w-full flex justify-center py-6">
                            <Spinner size="sm" color="secondary" />
                        </div>
                    )}
                </ScrollShadow>

                {/* Footer */}
                <div className="p-3 w-full bg-default-50 flex justify-center items-center border-t border-default-200">
                    <Button
                        size="sm"
                        color="secondary"
                        variant='light'
                        className='rounded-medium'
                        startContent={<Send size={14} />}
                        onPress={handleSubmit}
                        isLoading={isSubmitting}
                        isDisabled={isLoading}
                    >
                        Send Request
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}

// --- 3. EXPORT BAR ---
/**
 * A toolbar component for document export and related actions.
 * 
 * @param onHistoryButtonClick a function to handle history button click
 * @param onSettingsButtonClick a function to handle settings button click
 * 
 * @param previewable whether to show the preview button
 * @param onPreviewButtonClick a function to handle preview button click
 * 
 * @param exportable whether to show the export button
 * @param onExportButtonClick a function to handle export button click, receives the export format key
 * 
 * @param requireApproval whether to show the submit approval button
 * @param onSubmitApprovalClick a function to handle submit approval button click
 * 
 * @param approvalButtonConfig configuration object for the submit approval button
 * 
 * @param alertConfig configuration object for displaying an alert message
 *  
 * @returns 
 */
const ExportBar = ({
    onHistoryButtonClick,
    onSettingsButtonClick,
    settingsBadgeConfig,

    previewable = false,
    onPreviewButtonClick,

    exportable = false,
    onExportButtonClick,

    requireApproval = false,
    onSubmitApprovalClick,
    approvalButtonConfig,

    alertConfig,
}: {
    onHistoryButtonClick?: () => void;
    onSettingsButtonClick?: () => void;
    settingsBadgeConfig?: Omit<BadgeProps, "children">;

    previewable?: boolean;
    onPreviewButtonClick?: () => void;

    exportable?: boolean;
    onExportButtonClick?: (key: Key) => void;

    requireApproval?: boolean;
    onSubmitApprovalClick?: (ids: string[]) => void;
    approvalButtonConfig?: submitApprovalButtonConfig;

    alertConfig?: AlertProps;
}) => {
    return (
        <div className="w-full px-4 py-2 gap-4 bg-white border-b border-default-200 flex justify-end items-center">

            {
                alertConfig?.isVisible && <Alert 
                    {...alertConfig}
                    title={alertConfig.title} 
                    description={alertConfig.description} 
                    classNames={{
                        ...alertConfig.classNames,
                        base: `${alertConfig.classNames?.base} py-1`,
                        description: `${alertConfig.classNames?.description} text-xs`,
                        title: `${alertConfig.classNames?.title} font-bold`
                    }} 
                    color={alertConfig.color || "danger"}
                />
            }

            <div className='flex items-center gap-4'> 
                <div className="flex items-center gap-1">
                    {/* <Button isIconOnly variant="light" color="default" size="sm" onPress={onHistoryButtonClick}>
                        <History size={20} />
                    </Button> */}
                    <Badge {...settingsBadgeConfig} isInvisible={settingsBadgeConfig?.isInvisible ?? false}>
                        <Button isIconOnly variant="light" color="default" size="sm" onPress={onSettingsButtonClick}>
                            <Settings size={20} />
                        </Button>
                    </Badge>
                </div>

                { previewable || exportable ? (
                <ButtonGroup variant="flat" className='overflow-hidden rounded-medium' color="secondary">
                    {
                        previewable && (
                            <Button startContent={<EyeIcon size={18} />} onPress={onPreviewButtonClick}>
                                Preview
                            </Button>
                        )
                    }
                    {
                        exportable && (
                            <ExportButton types={[ExportType.PDF, ExportType.XML]} onPress={onExportButtonClick} />
                        )
                    }
                </ButtonGroup>
                ) : null }
                {
                    requireApproval && (
                        <SubmitApprovalButton onSubmit={onSubmitApprovalClick} config={approvalButtonConfig as submitApprovalButtonConfig} />
                    )
                }
            </div>
        </div>
    )
}

export default ExportBar