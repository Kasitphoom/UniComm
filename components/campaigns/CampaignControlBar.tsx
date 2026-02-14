"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SearchBar from "../SearchBar";
import type { RangeValue } from "@react-types/shared";
import type { DateValue } from "@internationalized/date";
import { parseDate } from "@internationalized/date";
import CampaignFilters from "./CampaignFilters";
import NewCampaignButton from "./NewCampaignButton";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchTemplates } from "@/features/templates/templatesSlice";
import { fetchCustomerLists } from "@/features/customers/customerListsSlice";

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

    return (
        <div className='flex flex-col md:flex-row gap-3 justify-end w-full animate-in fade-in duration-500'>

            <SearchBar props={{
                classNames: {
                    base: 'max-w-none! md:max-w-[300px]',
                }
            }} />

            <CampaignFilters
                currentScheduleStatus={currentScheduleStatus}
                currentFileStatus={currentFileStatus}
                currentRange={currentRange}
                initialCustomRange={initialCustomRange}
                onFilterChange={handleFilterChange}
                onClearAll={clearAllFilters}
            />
            <NewCampaignButton />
        </div>
    );
};

export default CampaignControlBar;