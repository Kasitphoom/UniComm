'use client'
import React, { useState, useEffect, useCallback, Key, useMemo } from 'react'
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
    BadgeProps,
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem
} from '@heroui/react'
import { useInfiniteScroll } from "@heroui/use-infinite-scroll"
import {
    EyeIcon,
    History,
    Settings,
    Send,
    ChevronDown,
    Search,
    CheckCircle2,
    AlertCircle,
    Clock,
    XCircle,
    Save
} from 'lucide-react'
import ExportButton, { ExportType } from './ExportButton'
import { APPROVAL_STATUS, BusinessUser } from '@/app/generated/business/prisma'
import { updateTemplateApprovers } from '@/features/templates/templatesSlice'
import { ApproverWithUser } from '@/types/approver'
import { useUser } from '../providers/UserProvider'

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
    currentApprovers?: ApproverWithUser[];
    isApprover?: boolean;
    updateApproveStatus?: (status: Key) => void;
}

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

    const approvers = config?.currentApprovers || []
    const user = useUser()

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

    const approvalSummary = useMemo(() => {
        // 1. ACTION STATE: No process has started yet
        if (approvers.length === 0) {
            return {
                label: "Submit for Approval", // Clear call to action
                color: "secondary" as const,  // Use your brand/primary action color
                icon: <Send size={16} />,      // Use a "Send" or "Upload" icon
                type: 'EMPTY'
            }
        }

        const approvedCount = approvers.filter(a => a.status === "APPROVED").length
        const rejectedCount = approvers.filter(a => a.status === "REJECTED").length

        // 2. ALERT STATE: Someone said no
        if (rejectedCount > 0) {
            return { label: "Rejected", color: "danger" as const, icon: <XCircle size={16} />, type: 'REJECTED' }
        }

        // 3. SUCCESS STATE: Everyone said yes
        if (approvedCount === approvers.length) {
            return { label: "Fully Approved", color: "success" as const, icon: <CheckCircle2 size={16} />, type: 'FULL' }
        }

        // 4. PROGRESS STATE: Some have said yes
        if (approvedCount > 0) {
            return {
                label: `${approvedCount}/${approvers.length} Approved`,
                color: "warning" as const,
                icon: <AlertCircle size={16} />,
                type: 'PARTIAL'
            }
        }

        // 5. WAITING STATE: Process started, but 0 approvals yet
        return { label: "Awaiting Approval", color: "warning" as const, icon: <Clock size={16} />, type: 'PENDING' }
    }, [approvers])

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

    const visibleItems = items.filter(item => item.id !== user.currentBusinessProfile?.id && !selectedUsers.find(sel => sel.userId === item.id))

    if (config.isApprover) {
        return (
            <ButtonGroup color={approvalSummary.color} variant="flat">
                {/* LEFT SIDE: The Status & Progress Viewer */}
                <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
                    <PopoverTrigger>
                        <Button 
                            className="font-bold px-4"
                            startContent={approvalSummary.icon}
                        >
                            {approvalSummary.label}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0">
                        {/* Your existing Progress List & User Items go here */}
                        <div className="p-4 w-full flex flex-col gap-4">
                            <div className="text-tiny font-bold text-default-400 uppercase mb-2">Current Progress</div>
                            <div className="flex flex-col gap-3">
                                {approvers.length > 0 && approvers.map((approver) => (
                                    <div key={approver.id} className="flex items-center justify-between bg-white p-2">
                                        <User
                                            name={`${approver.user.displayName}`} // Map this to real names in your actual implementation
                                            description={new Date(approver.updatedAt).toLocaleDateString()}
                                            avatarProps={{ size: "sm", name: approver.user.displayName }}
                                        />
                                        <Chip 
                                            size="sm" 
                                            variant="flat" 
                                            color={approver.status === "APPROVED" ? "success" : approver.status === "REJECTED" ? "danger" : approver.status === "PENDING" ? "warning" : "default"}
                                        >
                                            {approver.status}
                                        </Chip>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* RIGHT SIDE: The Action Menu */}
                <Dropdown placement="bottom-end">
                    <DropdownTrigger>
                        <Button isIconOnly className="w-8">
                            <ChevronDown size={16} />
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu 
                        aria-label="Approver Actions"
                        onAction={(key) => config.updateApproveStatus?.(key)}
                        className="min-w-37.5"
                    >
                        <DropdownItem 
                            key={APPROVAL_STATUS.APPROVED}
                            startContent={<CheckCircle2 size={18} className="text-success" />}
                            description="Approve this version"
                            className="py-3"
                        >
                            Approve
                        </DropdownItem>
                        <DropdownItem 
                            key={APPROVAL_STATUS.REJECTED}
                            variant="flat"
                            color="default"
                            startContent={<XCircle size={18} className="text-danger" />}
                            description="Request changes"
                            className="py-3"
                        >
                            Reject
                        </DropdownItem>
                    </DropdownMenu>
                </Dropdown>
            </ButtonGroup>
        );
    }

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
                {/* Enhanced Trigger: Uses the semantic color from the approvalSummary 
                  to instantly signal status to the user.
                */}
                <Button
                    color={approvalSummary.color}
                    variant="solid"
                    startContent={approvalSummary.icon}
                    endContent={<ChevronDown size={16} />}
                    isDisabled={config?.disabled}
                >
                    {approvalSummary.label}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-85 p-0 overflow-hidden">
                {approvers.length > 0 && (
                    <div className="p-4 border-b border-default-100 w-full">
                        <div className="text-tiny font-bold text-default-400 uppercase tracking-wider mb-3">
                            Approval Progress
                        </div>
                        <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
                            {approvers.map((approver) => (
                                <div key={approver.id} className="flex items-center justify-between bg-white p-2">
                                    <User
                                        name={`${approver.user.displayName}`} // Map this to real names in your actual implementation
                                        description={new Date(approver.updatedAt).toLocaleDateString()}
                                        avatarProps={{ size: "sm", name: approver.user.displayName }}
                                    />
                                    <Chip 
                                        size="sm" 
                                        variant="flat" 
                                        color={approver.status === "APPROVED" ? "success" : approver.status === "REJECTED" ? "danger" : approver.status === "PENDING" ? "warning" : "default"}
                                    >
                                        {approver.status}
                                    </Chip>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="p-4 w-full bg-white">
                    <div className="mb-2 font-bold text-small">
                        {approvers.length > 0 ? "Add / Remove Approvers" : "Request Approval"}
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
                <div className="p-3 w-full flex justify-end gap-2 bg-default-50 border-t border-default-200">
                    <Button size="sm" variant="light" onPress={() => setIsOpen(false)}>Close</Button>
                    <Button size="sm" color="secondary" onPress={handleSubmit}>
                        Update Request
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
 * @param saveable whether to show the save button
 * @param onSaveButtonClick a function to handle save button click
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

    saveable = false,
    onSaveButtonClick,
    isSaving = false,

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

    saveable?: boolean;
    onSaveButtonClick?: () => void;
    isSaving?: boolean;

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

                    {
                        saveable && (
                            <Button isIconOnly variant="light" startContent={!isSaving && <Save size={18} />} onPress={onSaveButtonClick} isLoading={isSaving}>
                            </Button>
                        )
                    }
                </div>

                { saveable || previewable || exportable ? (
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