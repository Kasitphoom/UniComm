"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    RadioGroup,
    cn,
    Checkbox,
    Tabs,
    Tab,
} from "@heroui/react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Upload, FileText, CheckCircle2, Info, Plus } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { resetCreateStatus } from "@/features/customers/customerListsSlice";
import { createCustomersFromCSV, createCustomersManual, fetchListCustomers } from "@/features/customers/listCustomersSlice";
import CustomRadio from "./CustomRadio";
import { ManualEntryGrid, ManualEntryGridHandle } from "./ManualEntryGrid";

// Create validation schema
const addCustomerSchema = yup.object().shape({
    source: yup
        .mixed<"MANUAL" | "CSV_UPLOAD">()
        .oneOf(["MANUAL", "CSV_UPLOAD"], "Invalid source")
        .required(),
    upsertMode: yup
        .boolean()
        .default(false),
});

type AddCustomerFormData = yup.InferType<typeof addCustomerSchema>;

interface AddCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    listId: string;
}

const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    listId,
}) => {
    const dispatch = useAppDispatch();
    const { contactList, status: listStatus, error: listError } = useAppSelector((state) => state.listCustomers);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [isDragActive, setIsDragActive] = useState(false);
    const [manualError, setManualError] = useState<string | null>(null);
    const [hasCreated, setHasCreated] = useState(false);
    const gridRef = useRef<ManualEntryGridHandle | null>(null);

    const {
        control,
        handleSubmit,
        reset,
        setValue,
    } = useForm<AddCustomerFormData>({
        mode: "onChange",
        resolver: yupResolver(addCustomerSchema),
        defaultValues: {
            source: "MANUAL",
            upsertMode: false,
        },
    });

    const sourceValue = useWatch({ control, name: "source" });
    const isLoading = listStatus === "loading";

    // Reset status when modal closes
    useEffect(() => {
        if (!isOpen) {
            setManualError(null);
            setHasCreated(false);
        }
    }, [isOpen]);

    // Handle successful creation
    useEffect(() => {
        if (listStatus === "succeeded" && hasCreated) {
            reset();
            setCsvFile(null);
            setManualError(null);
            setHasCreated(false);
            onClose();
            dispatch(fetchListCustomers({ id: listId }));
            if (onSuccess) {
                onSuccess();
            }
        }
    }, [listStatus, hasCreated, reset, onClose, onSuccess, listId, dispatch]);

    const handleFileChange = (file: File | null) => {
        if (!file) {
            setCsvFile(null);
            return;
        }

        // Validate file type
        if (!file.name.endsWith(".csv")) {
            setCsvFile(null);
            return;
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            setCsvFile(null);
            return;
        }

        setCsvFile(file);
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        handleFileChange(file || null);
    };

    const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setIsDragActive(true);
        } else if (e.type === "dragleave") {
            setIsDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);

        const file = e.dataTransfer.files?.[0];
        handleFileChange(file || null);
    };

    const onSubmit = async (data: AddCustomerFormData) => {
        try {
            if (data.source === "CSV_UPLOAD") {
                if (!csvFile) {
                    return;
                }

                setHasCreated(true);
                await dispatch(createCustomersFromCSV({
                    listId,
                    file: csvFile,
                })).unwrap();
            } else {
                // Manual mode validation: ensure primary key values are not empty
                const pk = contactList?.primaryKey?.trim();
                if (!pk) {
                    setManualError("Primary key is not configured for this list.");
                    return;
                }

                const hasEmpty = gridRef.current?.hasEmptyPrimaryKeys(pk);
                if (hasEmpty) {
                    setManualError(`Please fill all '${pk}' values before submitting.`);
                    return;
                }
                setManualError(null);
                // Manual customer creation with validated data
                const rows = gridRef.current?.getRows() ?? [];
                const customers = rows.map(r => r.data);
                
                setHasCreated(true);
                await dispatch(createCustomersManual({
                    listId,
                    customers,
                })).unwrap();
            }
        } catch (error) {
            console.error("Failed to add customers:", error);
        }
    };

    const handleClose = () => {
        reset();
        setCsvFile(null);
        setManualError(null);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            backdrop="blur"
            size="5xl" // Increased size to accommodate the spreadsheet grid
            scrollBehavior="inside"
            classNames={{
                base: "max-h-[90vh]",
                header: "border-b border-default-100 pb-4",
                footer: "border-t border-default-100 bg-default-50/50"
            }}
        >
            <ModalContent>
                <form id="add-customer-form" onSubmit={handleSubmit(onSubmit)}>
                    <ModalHeader className="flex flex-col gap-1">
                        <h2 className="text-lg font-bold tracking-tight">Add Customers</h2>
                        <p className="text-small text-default-500 font-normal">
                            Populate your list manually or via bulk import.
                        </p>
                    </ModalHeader>

                    <ModalBody className="py-6">
                        {(listError || manualError) && (
                            <div className="flex items-center gap-3 p-3 mb-6 rounded-xl bg-danger-50 text-danger text-sm border border-danger-100">
                                <Info size={18} />
                                {manualError || listError}
                            </div>
                        )}

                        <Tabs 
                            aria-label="Add methods" 
                            selectedKey={sourceValue}
                            onSelectionChange={(key) => setValue("source", key as AddCustomerFormData["source"])}
                            variant="underlined"
                            color="secondary"
                            classNames={{
                                tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
                                cursor: "w-full",
                            }}
                        >
                            {/* --- TAB 1: MANUAL ENTRY --- */}
                            <Tab key="MANUAL" title="Manual Entry">
                                <div className="pt-6 animate-in fade-in duration-500">
                                    <ManualEntryGrid ref={gridRef} fields={contactList?.fields} />
                                </div>
                            </Tab>

                            {/* --- TAB 2: CSV UPLOAD --- */}
                            <Tab key="CSV_UPLOAD" title="CSV Upload">
                                <div className="pt-6 flex flex-col gap-6 animate-in fade-in duration-500">
                                    <div className="flex flex-col gap-3">
                                        <label className="text-sm font-medium text-default-700">Upload File</label>
                                        <input
                                            type="file"
                                            accept=".csv"
                                            onChange={handleInputChange}
                                            className="hidden"
                                            id="csv-file-input"
                                        />
                                        <label htmlFor="csv-file-input" className="cursor-pointer group">
                                            <div
                                                onDragEnter={handleDrag}
                                                onDragLeave={handleDrag}
                                                onDragOver={handleDrag}
                                                onDrop={handleDrop}
                                                className={cn(
                                                    "relative flex flex-col items-center justify-center p-12 rounded-2xl border-2 border-dashed transition-all",
                                                    isDragActive ? "border-secondary-400 bg-secondary-50" : 
                                                    csvFile ? "border-success-200 bg-success-50/30" : 
                                                    "border-default-200 bg-default-50 group-hover:bg-default-100"
                                                )}
                                            >
                                                {!csvFile ? (
                                                    <>
                                                        <div className="p-3 rounded-full bg-white shadow-sm mb-3">
                                                            <Upload size={24} className="text-secondary" />
                                                        </div>
                                                        <p className="text-sm font-semibold">Click or drag CSV here</p>
                                                        <p className="text-xs text-default-400 mt-1">UTF-8 CSV up to 10MB</p>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center gap-4 w-full">
                                                        <div className="p-3 rounded-xl bg-success text-white">
                                                            <FileText size={24} />
                                                        </div>
                                                        <div className="flex flex-col flex-1">
                                                            <span className="text-sm font-bold truncate">{csvFile.name}</span>
                                                            <span className="text-tiny text-default-500">Ready for processing</span>
                                                        </div>
                                                        <CheckCircle2 size={24} className="text-success" />
                                                    </div>
                                                )}
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </Tab>
                        </Tabs>
                    </ModalBody>

                    <ModalFooter>
                        <Button variant="light" onPress={handleClose} isDisabled={isLoading}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form="add-customer-form"
                            color="secondary"
                            className="bg-[#7828C8] px-8 font-bold"
                            isLoading={isLoading}
                            isDisabled={isLoading || (sourceValue === "CSV_UPLOAD" && !csvFile)}
                            startContent={!isLoading && <Plus size={18} />}
                        >
                            Add Customers
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
};

export default AddCustomerModal;
