"use client";

import React, { useState } from "react";
import { Chip, Button, Divider, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { DatabaseIcon, CalendarIcon, ClockIcon, Eye, EditIcon, UsersIcon, Trash2, MoreVertical } from "lucide-react";
import { timeDifferenceFormatter } from "@/utils/DateFormatter";
import { ContactListDTO } from "@/features/customers/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { deleteCustomerList, resetDeleteStatus } from "@/features/customers/customerListsSlice";
import CreateCustomerListModal from "./CreateCustomerListModal";
import ConfirmDialog from "@/components/common/ConfirmDialog";

export enum CONTACT_SOURCE {
    MANUAL = "MANUAL",
    CSV_UPLOAD = "CSV_UPLOAD",
    SALESFORCE = "SALESFORCE",
}

interface ContactListCardProps {
    list: ContactListDTO;
    onEdit: (id: string) => void;
    onView: (id: string) => void;
}

const sourceColorMap: Record<CONTACT_SOURCE, "default" | "primary" | "secondary"> = {
    [CONTACT_SOURCE.MANUAL]: "default",
    [CONTACT_SOURCE.CSV_UPLOAD]: "primary",
    [CONTACT_SOURCE.SALESFORCE]: "secondary",
};

export const ContactListCard = ({ list, onEdit, onView }: ContactListCardProps) => {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const dispatch = useAppDispatch();
    const { status: deleteStatus } = useAppSelector((state) => state.customerLists.delete);

    const handleEditClick = () => {
        setIsEditModalOpen(true);
    };

    const handleDeleteClick = () => {
        setIsDeleteConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        try {
            await dispatch(deleteCustomerList(list.id)).unwrap();
            setIsDeleteConfirmOpen(false);
            dispatch(resetDeleteStatus());
        } catch (error) {
            console.error("Failed to delete customer list:", error);
        }
    };

    const isDeleting = deleteStatus === "loading";
    return (
        <div className="group relative flex md:grid md:grid-cols-[1fr_auto_auto] gap-4 flex-col md:flex-row items-start md:items-center justify-between p-4 bg-white border-b border-gray-100 hover:bg-gray-50 transition-all first:rounded-t-xl last:rounded-b-xl last:border-b-0 shadow-sm">
            <div className="flex flex-col gap-1 mb-4 md:mb-0">
                <div className="flex items-center justify-between md:justify-start gap-3 w-full">
                    <h3 className="text-foreground wrap-break-words line-clamp-2 md:pr-0">
                        {list.name}
                    </h3>
                    
                    <Chip
                        size="sm"
                        variant="flat"
                        color={sourceColorMap[list.source as CONTACT_SOURCE] || "default"}
                        className="h-5 text-[10px] shrink-0"
                        startContent={<DatabaseIcon size={10} className="ml-1" />}
                    >
                        {list.source?.replace("_", " ")}
                    </Chip>
                </div>
                   <p className="text-tiny text-default-400 max-w-full md:max-w-87.5 wrap-break-words line-clamp-2 md:line-clamp-1 mt-1">
                    {list.remarks || "No remarks provided"}
                </p>
            </div>

            <div className="grid grid-cols-3 gap-8 md:gap-4 mb-5 md:mb-0 w-fit">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 opacity-50">
                        <UsersIcon size={12} className="shrink-0" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Customers</span>
                    </div>
                    <span className="text-tiny whitespace-nowrap text-default-600">
                        {list._count?.customers || 0}
                    </span>
                </div>

                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 opacity-50">
                        <CalendarIcon size={12} className="shrink-0" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Created</span>
                    </div>
                    <span className="text-tiny whitespace-nowrap text-default-600">
                        {new Date(list.createdAt).toLocaleDateString()}
                    </span>
                </div>

                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 opacity-50">
                        <ClockIcon size={12} className="shrink-0" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Updated</span>
                    </div>
                    <span className="text-tiny text-secondary whitespace-nowrap font-medium">
                        {timeDifferenceFormatter(new Date(list.updatedAt))}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end pt-4 md:pt-0 border-t md:border-t-0 border-gray-50 shrink-0">
                <Button
                    size="sm"
                    variant="flat"
                    color="secondary"
                    className="px-6 md:px-4 font-semibold"
                    onPress={() => onView(list.id)}
                    startContent={<Eye size={16} />}
                >
                    View List
                </Button>

                <Dropdown>
                    <DropdownTrigger>
                        <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            className="text-default-400"
                        >
                            <MoreVertical size={18} />
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="List actions">
                        <DropdownItem
                            key="edit"
                            startContent={<EditIcon size={16} />}
                            onPress={handleEditClick}
                        >
                            Edit
                        </DropdownItem>
                        <DropdownItem
                            key="delete"
                            className="text-danger"
                            color="danger"
                            startContent={<Trash2 size={16} />}
                            onPress={handleDeleteClick}
                        >
                            Delete
                        </DropdownItem>
                    </DropdownMenu>
                </Dropdown>
            </div>

            {/* Edit Modal */}
            <CreateCustomerListModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                listToEdit={list}
                onSuccess={() => {
                    setIsEditModalOpen(false);
                    onEdit(list.id);
                }}
            />

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={isDeleteConfirmOpen}
                title="Delete Contact List"
                content={<div>Are you sure you want to delete <span className="font-bold">{list.name}</span>? This action cannot be undone.</div>}
                onCancel={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
                confirmText="Delete"
                isConfirmLoading={isDeleting}
                confirmButtonProps={{ color: "danger" }}
            />
        </div>
    );
};