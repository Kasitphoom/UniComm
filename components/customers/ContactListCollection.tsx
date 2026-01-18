"use client";

import React, { useEffect } from "react";
import { ContactListCard, CONTACT_SOURCE } from "./ContactListCard";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCustomerLists } from "@/features/customers/customerListsSlice";
import { Spinner } from "@heroui/react";

// Mocking one customer list as requested
const MOCK_LISTS = [
    {
        id: "65a7f1234567890abcdef123",
        name: "VIP Premium Customers",
        source: CONTACT_SOURCE.SALESFORCE,
        remarks: "Top 100 high-value customers for Q1 campaign",
        createdAt: new Date("2025-12-20T08:00:00Z"),
        updatedAt: new Date(), // Using current date to test formatter
    },
    {
        id: "65a7f9876543210fedcba321",
        name: "Newsletter Leads",
        source: CONTACT_SOURCE.CSV_UPLOAD,
        remarks: "Organic leads from landing page footer",
        createdAt: new Date("2026-01-01T10:30:00Z"),
        updatedAt: new Date(Date.now() - 3600000 * 5), // 5 hours ago
    }
];

export default function ContactListCollection() {

    const dispatch = useAppDispatch();
    const { items: customerList, status, error } = useAppSelector((state) => state.customerLists.list)

    const handleEdit = (id: string) => {
        console.log("Navigating to edit list:", id);
        // router.push(`/dashboard/lists/${id}/edit`);
    };

    const handleView = (id: string) => {
        console.log("Navigating to view list:", id);
        // router.push(`/dashboard/lists/${id}`);
    }

    useEffect(() => {
        // Dispatch fetch action if needed
        if (status === "idle") {
            dispatch(fetchCustomerLists());
        }
    }, [status, dispatch]);

    return (
        <div className="border border-gray-200 bg-white rounded-xl overflow-hidden shadow-sm">
            {status === "idle" ? 
                <div className="p-6 flex justify-center items-center w-full">
                    <Spinner color="default" >Preparing</Spinner>
                </div> 
            : status === "loading" ? 
                <div className="p-6 flex justify-center items-center w-full">
                    <Spinner color="secondary" >Loading</Spinner>
                </div>
            : customerList.length === 0 ? 
                <div className="p-6 text-center text-default-400">
                    No customer lists found.
                </div>
            : customerList.map((list) => (
                <ContactListCard
                    key={list.id}
                    list={list}
                    onEdit={handleEdit}
                    onView={handleView}
                />
            ))}
        </div>
    );
}