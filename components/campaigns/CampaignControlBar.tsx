"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { 
    Button, Dropdown, DropdownTrigger, DropdownMenu, 
    DropdownItem, ButtonGroup, DateRangePicker, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter 
} from "@heroui/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ListFilter, RotateCcw, CalendarDays, File, Clock } from "lucide-react";
import SearchBar from "../SearchBar";
import type { RangeValue } from "@react-types/shared";
import type { DateValue } from "@internationalized/date";
import { getLocalTimeZone, now, parseDate } from "@internationalized/date";

const CampaignControlBar = () => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const createQueryString = useCallback(
        (updates: Record<string, string | null>) => {
            const params = new URLSearchParams(searchParams.toString());
            
            Object.entries(updates).forEach(([name, value]) => {
                if (value === "ALL" || value === null) {
                    params.delete(name);
                } else {
                    params.set(name, value);
                }
            });

            params.set("page", "1"); 
            return params.toString();
        },
        [searchParams]
    );

    const handleFilterChange = (updates: Record<string, string | null>) => {
        router.push(`${pathname}?${createQueryString(updates)}`);
    };

    const clearAllFilters = () => router.push(pathname);

    // URL States
    const currentScheduleStatus = searchParams.get("scheduleStatus") || "ALL";
    const currentFileStatus = searchParams.get("fileStatus") || "ALL";
    const currentRange = searchParams.get("range") || "ALL";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const initialCustomRange = useMemo(() => {
        if (!startDateParam || !endDateParam) return null;
        try {
            return {
                start: parseDate(startDateParam),
                end: parseDate(endDateParam),
            } as RangeValue<DateValue>;
        } catch {
            return null;
        }
    }, [startDateParam, endDateParam]);

    const [customRange, setCustomRange] = useState<RangeValue<DateValue> | null>(initialCustomRange);
    const [isCustomModalOpen, setCustomModalOpen] = useState(false);

    useEffect(() => {
        setCustomRange(initialCustomRange);
    }, [initialCustomRange]);

    const applyCustomRange = (range: RangeValue<DateValue> | null) => {
        if (!range?.start || !range?.end) return;
        handleFilterChange({
            range: "CUSTOM",
            startDate: range.start.toString(),
            endDate: range.end.toString(),
        });
        setCustomModalOpen(false);
    };

    return (
        <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between w-full animate-in fade-in duration-500'>
            <div className='flex-1 max-w-md'>
                <SearchBar />
            </div>

            <div className='flex flex-wrap items-center gap-2'>
                <ButtonGroup variant="flat" color="secondary">
                    {/* Schedule Status */}
                    <Dropdown placement="bottom-end">
                        <DropdownTrigger>
                            <Button 
                                startContent={<ListFilter size={16} />}
                                endContent={<ChevronDown size={14} />}
                                className="font-bold border-r-1 border-secondary-200/30"
                            >
                                {currentScheduleStatus.toLowerCase()}
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu 
                            aria-label="Schedule Status"
                            disallowEmptySelection
                            selectionMode="single"
                            selectedKeys={new Set([currentScheduleStatus])}
                            onSelectionChange={(keys) => handleFilterChange({ scheduleStatus: Array.from(keys)[0] as string })}
                        >
                            <DropdownItem key="ALL">All Statuses</DropdownItem>
                            <DropdownItem key="PENDING">Pending</DropdownItem>
                            <DropdownItem key="TRIGGERED">Triggered</DropdownItem>
                            <DropdownItem key="FAILED" color="danger" className="text-danger">Failed</DropdownItem>
                        </DropdownMenu>
                    </Dropdown>

                    {/* File Status */}
                    <Dropdown placement="bottom-end">
                        <DropdownTrigger>
                            <Button 
                                startContent={<File size={16} />}
                                endContent={<ChevronDown size={14} />}
                                className="font-bold border-r-1 border-secondary-200/30"
                            >
                                Files: {currentFileStatus.toLowerCase()}
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu 
                            aria-label="File Status"
                            disallowEmptySelection
                            selectionMode="single"
                            selectedKeys={new Set([currentFileStatus])}
                            onSelectionChange={(keys) => handleFilterChange({ fileStatus: Array.from(keys)[0] as string })}
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
                                startContent={<CalendarDays size={16} />}
                                endContent={<ChevronDown size={14} />}
                                className="font-bold"
                            >
                                {currentRange === "ALL" ? "Anytime" : currentRange.replace("_", " ").toLowerCase()}
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu 
                            aria-label="Date Range"
                            disallowEmptySelection
                            selectionMode="single"
                            selectedKeys={new Set([currentRange])}
                            onSelectionChange={(keys) => {
                                const val = Array.from(keys)[0] as string;
                                if (val === "CUSTOM") {
                                    setCustomRange(initialCustomRange)
                                    setCustomModalOpen(true);
                                    return;
                                }
                                handleFilterChange({
                                    range: val,
                                    startDate: null,
                                    endDate: null,
                                });
                            }}
                        >
                            <DropdownItem key="ALL">Anytime</DropdownItem>
                            <DropdownItem key="TODAY">Today</DropdownItem>
                            <DropdownItem key="LAST_7_DAYS">Last 7 Days</DropdownItem>
                            <DropdownItem key="THIS_MONTH">This Month</DropdownItem>
                            <DropdownItem key="CUSTOM" className="text-secondary">Custom Range</DropdownItem>
                        </DropdownMenu>
                    </Dropdown>
                </ButtonGroup>

                {/* Reset All */}
                {(currentScheduleStatus !== "ALL" || currentFileStatus !== "ALL" || currentRange !== "ALL") && (
                    <Button 
                        isIconOnly 
                        variant="light" 
                        color="secondary"
                        onPress={clearAllFilters}
                    >
                        <RotateCcw size={18} />
                    </Button>
                )}
            </div>

            <Modal 
                isOpen={isCustomModalOpen} 
                onOpenChange={(open) => {
                    setCustomModalOpen(open);
                }}
                placement="center"
                backdrop="blur"
                classNames={{
                    base: "border-[#7828C8]/20 border-1",
                    header: "border-b-[1px] border-default-100",
                    footer: "border-t-[1px] border-default-100",
                }}
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex gap-2 items-center">
                                <Clock size={20} />
                                <span className="font-bold">Schedule Range</span>
                            </ModalHeader>
                            
                            <ModalBody className="py-6">
                                <div className="flex flex-col gap-4">
                                    <DateRangePicker
                                        aria-label="Campaign schedule date and time"
                                        value={customRange || {
                                            start: now(getLocalTimeZone()),
                                            end: now(getLocalTimeZone()),
                                        }}
                                        onChange={setCustomRange}
                                        label="Custom Period"
                                        labelPlacement="outside"
                                        /* --- LATEST HEROUI FEATURES --- */
                                        hideTimeZone={true}
                                        granularity="minute" // This enables the Time Fields
                                        visibleMonths={1}
                                        showMonthAndYearPickers
                                        variant="bordered"
                                        color="secondary"
                                        className="max-w-full"
                                        calendarProps={{
                                            className: "shadow-none border-none",
                                            nextButtonProps: { variant: "light" },
                                            prevButtonProps: { variant: "light" }
                                        }}
                                    />
                                    
                                    <div className="p-3 rounded-medium bg-secondary-50/50 border-1 border-secondary-100">
                                        <p className="text-[11px] text-secondary-600 leading-relaxed">
                                            Showing campaigns scheduled or triggered between the selected start and end times. 
                                            Leave the time as 00:00 to include the full start day.
                                        </p>
                                    </div>
                                </div>
                            </ModalBody>

                            <ModalFooter className="bg-default-50/50">
                                <Button 
                                    variant="light" 
                                    className="font-medium"
                                    onPress={() => {
                                        setCustomRange(initialCustomRange);
                                        onClose();
                                    }}
                                >
                                    Reset
                                </Button>
                                <Button
                                    color="secondary"
                                    className="font-bold shadow-lg shadow-secondary/20"
                                    isDisabled={!customRange?.start || !customRange?.end}
                                    onPress={() => {
                                        applyCustomRange(customRange);
                                        onClose();
                                    }}
                                >
                                    Apply Filter
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default CampaignControlBar;