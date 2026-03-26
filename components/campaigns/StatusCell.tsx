"use client"
import { Chip } from "@heroui/react";
import { Clock, CheckCircle2, AlertCircle, FileSearch, Trash2 } from "lucide-react";

export const StatusCell = ({ status, type }: { status: string, type: 'schedule' | 'file' }) => {
    const config = {
        // Schedule Status Mapping
        PENDING: { color: "primary", icon: <Clock size={14}/>, label: "Scheduled" },
        RUNNING: { color: "primary", icon: <Clock size={14}/>, label: "Running" },
        TRIGGERED: { color: "success", icon: <CheckCircle2 size={14}/>, label: "Executed" },
        FAILED: { color: "danger", icon: <AlertCircle size={14}/>, label: "Failed" },
        // File Status Mapping
        EMPTY: { color: "default", icon: <FileSearch size={14}/>, label: "No Files" },
        AVALIABLE: { color: "success", icon: <CheckCircle2 size={14}/>, label: "Ready" },
        EXPIRED: { color: "warning", icon: <Trash2 size={14}/>, label: "Cleaned Up" },
    }[status] || { color: "default", label: status };

    return (
        <Chip
            startContent={config.icon}
            color={config.color as any}
            variant="flat"
            size="sm"
            className="capitalize gap-1"
        >
            {config.label}
        </Chip>
    );
};