"use client";

import React, { useState, forwardRef, useImperativeHandle } from "react";
import {
    Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
    Button, Input, Card
} from "@heroui/react";
import { Plus, Trash2, UserPlus } from "lucide-react";

// Define a local interface for clarity based on your prisma Json structure
interface DynamicField {
    field: string;
    type: string;
}

export type ManualEntryGridHandle = {
    /** Returns true if any row has an empty primary key value */
    hasEmptyPrimaryKeys: (primaryKey: string) => boolean;
    /** Access current rows data */
    getRows: () => Array<{ id: string; data: Record<string, any> }>;
};

export const ManualEntryGrid = React.memo(forwardRef<ManualEntryGridHandle, { fields: any[] | undefined }>(
    ({ fields }, ref) => {
    const [rows, setRows] = useState<any[]>([
        { id: crypto.randomUUID(), data: {} }
    ]);

    // Safety cast for your dynamic fields
    const typedFields = (fields || []) as DynamicField[];

    const addRow = () => {
        setRows([...rows, { id: crypto.randomUUID(), data: {} }]);
    };

    const removeRow = (id: string) => {
        if (rows.length > 1) {
            setRows(rows.filter(row => row.id !== id));
        }
    };

    const handleInputChange = (id: string, key: string, value: string) => {
        setRows(rows.map(row =>
            row.id === id ? { ...row, data: { ...row.data, [key]: value } } : row
        ));
    };

    // Imperative API for submit-time validation
    useImperativeHandle(ref, () => ({
        hasEmptyPrimaryKeys: (primaryKey: string) => {
            if (!primaryKey) return true;
            // Ensure primary key exists in fields
            const hasField = typedFields.some(f => f.field === primaryKey);
            if (!hasField) return true;
            // Check each row for non-empty primary key value
            return rows.some(row => {
                const val = row.data?.[primaryKey];
                return typeof val !== "string" || val.trim().length === 0;
            });
        },
        getRows: () => rows,
    }), [rows, typedFields]);

    if (typedFields.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10">
                <UserPlus size={48} className="text-default-300 mb-4" />
                <p className="text-default-500 text-sm">No fields available for manual entry.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center px-1">
                <span className="text-tiny text-default-400 font-medium uppercase tracking-wider">
                    Add customers line by line
                </span>
                <Button
                    size="sm"
                    variant="flat"
                    color="secondary"
                    onPress={addRow}
                    startContent={<Plus size={16} />}
                >
                    Add Row
                </Button>
            </div>

            <Card className="border border-default-100 shadow-none overflow-hidden">
                <div className="overflow-x-auto">
                    <Table
                        aria-label="Manual entry grid"
                        removeWrapper
                        className="min-w-[1000px]" // Fixed min-width ensures horizontal scroll works
                        classNames={{
                            th: "bg-default-50 text-default-500 text-[10px] font-bold py-3",
                            td: "py-2 border-b border-default-50 last:border-none"
                        }}
                    >
                        <TableHeader>
                            {[
                                ...typedFields.map((f) => (
                                    <TableColumn key={f.field}>{f.field}</TableColumn>
                                )),
                                <TableColumn key="actions" width={80}>ACTIONS</TableColumn>
                            ]}
                        </TableHeader>

                        <TableBody items={rows}>
                            {(row) => (
                                <TableRow key={row.id}>
                                    {[
                                        ...typedFields.map((f) => (
                                            <TableCell key={`${row.id}-${f.field}`}>
                                                <Input
                                                    variant="underlined"
                                                    size="sm"
                                                    placeholder="..."
                                                    value={row.data[f.field] || ""}
                                                    onChange={(e) => handleInputChange(row.id, f.field, e.target.value)}
                                                    classNames={{
                                                        input: "text-small",
                                                        inputWrapper: "border-b-default-100 after:bg-secondary"
                                                    }}
                                                />
                                            </TableCell>
                                        )),
                                        <TableCell key={`${row.id}-actions`}>
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="light"
                                                color="danger"
                                                isDisabled={rows.length === 1}
                                                onPress={() => removeRow(row.id)}
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        </TableCell>
                                    ]}
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}));