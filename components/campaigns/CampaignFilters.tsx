"use client"

import React, { useEffect, useState } from "react"
import {
    Button,
    ButtonGroup,
    DateRangePicker,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
} from "@heroui/react"
import type { RangeValue } from "@react-types/shared"
import type { DateValue } from "@internationalized/date"
import { getLocalTimeZone, now } from "@internationalized/date"
import { CalendarDays, ChevronDown, Clock, File, ListFilter, RotateCcw } from "lucide-react"

export type CampaignFiltersProps = {
    currentScheduleStatus: string
    currentFileStatus: string
    currentRange: string
    initialCustomRange: RangeValue<DateValue> | null
    onFilterChange: (updates: Record<string, string | null>) => void
    onClearAll: () => void
}

const CampaignFilters = ({
    currentScheduleStatus,
    currentFileStatus,
    currentRange,
    initialCustomRange,
    onFilterChange,
    onClearAll,
}: CampaignFiltersProps) => {
    const [customRange, setCustomRange] = useState<RangeValue<DateValue> | null>(initialCustomRange)
    const [isCustomModalOpen, setCustomModalOpen] = useState(false)

    useEffect(() => {
        setCustomRange(initialCustomRange)
    }, [initialCustomRange])

    const applyCustomRange = (range: RangeValue<DateValue> | null) => {
        if (!range?.start || !range?.end) return
        onFilterChange({
            range: "CUSTOM",
            startDate: range.start.toString(),
            endDate: range.end.toString(),
        })
        setCustomModalOpen(false)
    }

    const shouldShowReset =
        currentScheduleStatus !== "ALL" ||
        currentFileStatus !== "ALL" ||
        currentRange !== "ALL"

    return (
        /* Container uses gap-3 and wrap to handle small viewports naturally */
        <div className="flex flex-wrap items-center gap-3">
            <ButtonGroup 
                variant="flat" 
                color="secondary" 
                className="w-full sm:w-auto overflow-hidden"
            >
                {/* Schedule Status */}
                <Dropdown placement="bottom-end">
                    <DropdownTrigger>
                        <Button
                            startContent={<ListFilter size={16} className="shrink-0" />}
                            endContent={<ChevronDown size={14} className="shrink-0" />}
                            className="font-bold border-r-1 border-secondary-200/30 flex-1 sm:flex-none"
                        >
                            <span className="truncate">{currentScheduleStatus.toLowerCase()}</span>
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                        aria-label="Schedule Status"
                        disallowEmptySelection
                        selectionMode="single"
                        selectedKeys={new Set([currentScheduleStatus])}
                        onSelectionChange={(keys) =>
                            onFilterChange({ scheduleStatus: Array.from(keys)[0] as string })
                        }
                    >
                        <DropdownItem key="ALL">All Statuses</DropdownItem>
                        <DropdownItem key="PENDING">Pending</DropdownItem>
                        <DropdownItem key="RUNNING">Running</DropdownItem>
                        <DropdownItem key="TRIGGERED">Executed</DropdownItem>
                        <DropdownItem key="FAILED" color="danger" className="text-danger">
                            Failed
                        </DropdownItem>
                    </DropdownMenu>
                </Dropdown>

                {/* File Status */}
                <Dropdown placement="bottom-end">
                    <DropdownTrigger>
                        <Button
                            startContent={<File size={16} className="shrink-0" />}
                            endContent={<ChevronDown size={14} className="shrink-0" />}
                            className="font-bold border-r-1 border-secondary-200/30 flex-1 sm:flex-none"
                        >
                            <span className="truncate hidden md:inline">Files: </span>
                            <span className="truncate">{currentFileStatus.toLowerCase()}</span>
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                        aria-label="File Status"
                        disallowEmptySelection
                        selectionMode="single"
                        selectedKeys={new Set([currentFileStatus])}
                        onSelectionChange={(keys) =>
                            onFilterChange({ fileStatus: Array.from(keys)[0] as string })
                        }
                    >
                        <DropdownItem key="ALL">All Files</DropdownItem>
                        <DropdownItem key="AVALIABLE">Available</DropdownItem>
                        <DropdownItem key="EXPIRED">Expired</DropdownItem>
                        <DropdownItem key="EMPTY">Empty</DropdownItem>
                    </DropdownMenu>
                </Dropdown>

                {/* Date Range Filter */}
                <Dropdown placement="bottom-end">
                    <DropdownTrigger>
                        <Button
                            startContent={<CalendarDays size={16} className="shrink-0" />}
                            endContent={<ChevronDown size={14} className="shrink-0" />}
                            className="font-bold flex-1 sm:flex-none"
                        >
                            <span className="truncate">
                                {currentRange === "ALL"
                                    ? "Anytime"
                                    : currentRange.replace("_", " ").toLowerCase()}
                            </span>
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                        aria-label="Date Range"
                        disallowEmptySelection
                        selectionMode="single"
                        selectedKeys={new Set([currentRange])}
                        onSelectionChange={(keys) => {
                            const val = Array.from(keys)[0] as string
                            if (val === "CUSTOM") {
                                setCustomRange(initialCustomRange)
                                setCustomModalOpen(true)
                                return
                            }
                            onFilterChange({
                                range: val,
                                startDate: null,
                                endDate: null,
                            })
                        }}
                    >
                        <DropdownItem key="ALL">Anytime</DropdownItem>
                        <DropdownItem key="TODAY">Today</DropdownItem>
                        <DropdownItem key="LAST_7_DAYS">Last 7 Days</DropdownItem>
                        <DropdownItem key="THIS_MONTH">This Month</DropdownItem>
                        <DropdownItem key="CUSTOM" className="text-secondary">
                            Custom Range
                        </DropdownItem>
                    </DropdownMenu>
                </Dropdown>
            </ButtonGroup>

            {/* Reset All */}
            {shouldShowReset && (
                <Button 
                    isIconOnly 
                    variant="light" 
                    color="secondary" 
                    onPress={onClearAll}
                    className="shrink-0"
                >
                    <RotateCcw size={18} />
                </Button>
            )}

            <Modal
                isOpen={isCustomModalOpen}
                onOpenChange={(open) => setCustomModalOpen(open)}
                backdrop="blur"
                /* Modal size is small by default for mobile, lg for desktop */
                size="md" 
                classNames={{
                    base: "border-[#7828C8]/20 border-1 max-h-[90vh] overflow-y-auto",
                    header: "border-b-[1px] border-default-100 px-4 md:px-6",
                    body: "p-4 md:p-8",
                    footer: "border-t-[1px] border-default-100 px-4 md:px-6",
                }}
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex gap-2 items-center">
                                <Clock size={20} className="text-secondary" />
                                <span className="font-bold text-lg">Schedule Range</span>
                            </ModalHeader>

                            <ModalBody className="py-6">
                                <div className="flex flex-col gap-6">
                                    <DateRangePicker
                                        aria-label="Campaign schedule date and time"
                                        value={
                                            customRange || {
                                                start: now(getLocalTimeZone()),
                                                end: now(getLocalTimeZone()),
                                            }
                                        }
                                        onChange={setCustomRange}
                                        label="Select Custom Window"
                                        labelPlacement="outside"
                                        hideTimeZone
                                        granularity="minute"
                                        visibleMonths={1}
                                        showMonthAndYearPickers
                                        variant="bordered"
                                        color="secondary"
                                        className="w-full min-w-0" 
                                        classNames={{
                                            input: "text-xs md:text-sm truncate", 
                                            inputWrapper: "px-2 md:px-4 shrink-0 overflow-hidden" 
                                        }}
                                        calendarProps={{
                                            className: "shadow-none border-none p-0",
                                            nextButtonProps: { variant: "light", size: "sm" },
                                            prevButtonProps: { variant: "light", size: "sm" },
                                        }}
                                    />

                                    <div className="p-4 rounded-xl bg-secondary-50/50 border-1 border-secondary-100">
                                        <p className="text-xs text-secondary-600 leading-relaxed font-medium">
                                            Filtering campaigns executed between the selected start and end times.
                                        </p>
                                    </div>
                                </div>
                            </ModalBody>

                            <ModalFooter className="bg-default-50/50 flex flex-col sm:flex-row gap-2">
                                <Button
                                    variant="light"
                                    className="font-medium order-2 sm:order-1 sm:w-auto"
                                    onPress={() => {
                                        setCustomRange(initialCustomRange)
                                        onClose()
                                    }}
                                    fullWidth
                                >
                                    Cancel
                                </Button>
                                <Button
                                    color="secondary"
                                    className="font-bold shadow-lg shadow-secondary/20 order-1 sm:order-2 sm:w-auto"
                                    isDisabled={!customRange?.start || !customRange?.end}
                                    onPress={() => {
                                        applyCustomRange(customRange)
                                        onClose()
                                    }}
                                    fullWidth
                                >
                                    Apply Filter
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    )
}

export default CampaignFilters