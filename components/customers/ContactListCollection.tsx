"use client";

import React from "react";
import { ContactListCard, CONTACT_SOURCE } from "./ContactListCard";

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
    const handleEdit = (id: string) => {
        console.log("Navigating to edit list:", id);
        // router.push(`/dashboard/lists/${id}/edit`);
    };

    const handleView = (id: string) => {
        console.log("Navigating to view list:", id);
        // router.push(`/dashboard/lists/${id}`);
    }

    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {MOCK_LISTS.map((list) => (
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