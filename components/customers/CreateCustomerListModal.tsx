"use client";

import React, { useState, useEffect } from "react";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
    Textarea,
    RadioGroup,
    Radio,
    Card,
    RadioProps,
    useRadio,
    cn,
    VisuallyHidden,
    Divider,
    Checkbox,
    Select,
    SelectItem,
} from "@heroui/react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Upload, FileText, CheckCircle2, Info, Plus } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
    createCustomerListManual,
    createCustomerListWithCSV,
    patchCustomerList,
    resetCreateStatus,
    resetUpdateStatus
} from "@/features/customers/customerListsSlice";
import { ContactListDTO } from "@/features/customers/types";
import { Customer } from "@/app/generated/business/prisma";
import { fetchListCustomers } from "@/features/customers/listCustomersSlice";

// Create validation schema
const createCustomerListSchema = yup.object().shape({
    name: yup
        .string()
        .required("Name is required")
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name must not exceed 100 characters"),
    remarks: yup
        .string()
        .transform((value) => value || "")
        .max(500, "Remarks must not exceed 500 characters")
        .default(""),
    source: yup
        .mixed<"MANUAL" | "CSV_UPLOAD">()
        .oneOf(["MANUAL", "CSV_UPLOAD"], "Invalid source")
        .required(),
    primaryKey: yup
        .string()
        .optional()
        .default(""),
    upsertMode: yup
        .boolean()
        .default(false),
});

type CreateCustomerListFormData = yup.InferType<typeof createCustomerListSchema>;


const CustomRadio = (props: RadioProps) => {
    const {
        Component, children, isSelected, description,
        getBaseProps, getWrapperProps, getInputProps,
    } = useRadio(props);

    return (
        <Component
            {...getBaseProps()}
            className={cn(
                "group inline-flex items-center hover:bg-content2",
                "max-w-full cursor-pointer border-2 border-default-200 rounded-xl gap-4 p-4",
                "data-[selected=true]:border-secondary data-[selected=true]:bg-secondary-50/50",
            )}
        >
            <VisuallyHidden>
                <input {...getInputProps()} />
            </VisuallyHidden>
            {/* <span {...getWrapperProps()} className={cn(
                "border-2 border-default-300 group-data-[selected=true]:border-secondary",
                "shrink-0 w-5 h-5"
            )} /> */}
            <div className="flex flex-col gap-1">
                {children && <span className="font-semibold text-sm">{children}</span>}
                {description && (
                    <span className="text-tiny text-default-400">{description}</span>
                )}
            </div>
        </Component>
    );
};


interface CreateCustomerListModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    listToEdit?: ContactListDTO;
    showAdvancedSettings?: boolean;
    customers?: Customer[];
}

const CreateCustomerListModal: React.FC<CreateCustomerListModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    listToEdit,
    showAdvancedSettings = false,
}) => {
    const dispatch = useAppDispatch();
    const { status: createStatus, error: createError } = useAppSelector((state) => state.customerLists.create);
    const { status: updateStatus, error: updateError } = useAppSelector((state) => state.customerLists.update);
    const [csvFile, setCsvFile] = useState<File | null>(null);

    const isEditing = !!listToEdit;
    const status = isEditing ? updateStatus : createStatus;
    const error = isEditing ? updateError : createError;

    // Extract unique field keys from customer data
    const getListToEditField = (): string[] => {
        if (!listToEdit || !listToEdit.fields) return [];
        if (!Array.isArray(listToEdit.fields)) return [];
        return listToEdit.fields
            .filter((field): field is { field: string; type: string } => 
                typeof field === 'object' && field !== null && 'field' in field
            )
            .map((field) => field.field);
    };

    const fieldKeys = getListToEditField();

    const {
        control,
        handleSubmit,
        reset,
        watch,
        formState: { errors, isValid },
    } = useForm<CreateCustomerListFormData>({
        mode: "onChange",
        resolver: yupResolver(createCustomerListSchema),
        defaultValues: {
            name: listToEdit?.name || "",
            remarks: listToEdit?.remarks || "",
            source: "MANUAL",
            primaryKey: listToEdit?.primaryKey || "",
            upsertMode: listToEdit?.upsertMode ?? true,
        },
    });

    const sourceValue = watch("source");

    // Reset status when modal closes
    useEffect(() => {
        if (!isOpen) {
            dispatch(isEditing ? resetUpdateStatus() : resetCreateStatus());
        } else {
            reset({
                name: listToEdit?.name || "",
                remarks: listToEdit?.remarks || "",
                source: "MANUAL",
                primaryKey: listToEdit?.primaryKey || "",
                upsertMode: listToEdit?.upsertMode ?? true,
            })
        }
    }, [isOpen, dispatch, isEditing]);

    // Handle successful creation
    useEffect(() => {
        if (status === "succeeded") {
            reset();
            setCsvFile(null);
            onClose();
            if (onSuccess) {
                onSuccess();
            }
        }
    }, [status, reset, onClose, onSuccess]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

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

    const onSubmit = async (data: CreateCustomerListFormData) => {
        try {
            if (isEditing && listToEdit) {
                // Handle edit
                await dispatch(patchCustomerList({
                    id: listToEdit.id,
                    name: data.name,
                    remarks: data.remarks || undefined,
                    primaryKey: showAdvancedSettings ? data.primaryKey || undefined : undefined,
                    upsertMode: showAdvancedSettings ? data.upsertMode : undefined,
                })).unwrap();

                dispatch(fetchListCustomers({ id: listToEdit.id }));
            } else if (data.source === "CSV_UPLOAD") {
                // Handle CSV upload creation
                if (!csvFile) {
                    return;
                }

                await dispatch(createCustomerListWithCSV({
                    name: data.name,
                    file: csvFile,
                    remarks: data.remarks || undefined,
                    upsertMode: data.upsertMode,
                })).unwrap();
            } else {
                // Handle manual creation
                await dispatch(createCustomerListManual({
                    name: data.name,
                    source: data.source as "MANUAL" | "SALESFORCE",
                    remarks: data.remarks || undefined,
                    upsertMode: data.upsertMode,
                })).unwrap();
            }
        } catch (error) {
            // Error is handled by Redux state
            console.error("Failed to create/update customer list:", error);
        }
    };

    const handleClose = () => {
        reset();
        setCsvFile(null);
        dispatch(isEditing ? resetUpdateStatus() : resetCreateStatus());
        onClose();
    };

    const isLoading = status === "loading";

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            backdrop="blur"
            size="2xl"
            scrollBehavior="inside"
        >
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    <h2 className="text-lg font-bold tracking-tight">
                        {isEditing ? "Edit Customer List" : "Create Customer List"}
                    </h2>
                    <p className="text-small text-default-500 font-normal">
                        {isEditing
                            ? "Update the list name and description."
                            : "Define your customer segment and choose how to populate the data."
                        }
                    </p>
                </ModalHeader>
                <ModalBody>
                    <form className="flex flex-col gap-8" id="customer-list-form" onSubmit={handleSubmit(onSubmit)}>
                        {error && (
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-danger-50 text-danger text-sm border border-danger-100">
                                <Info size={18} />
                                {error}
                            </div>
                        )}

                        {/* --- Section 1: Basic Info --- */}
                        <div className="flex flex-col gap-4">
                            <Controller
                                name="name"
                                control={control}
                                render={({ field }) => (
                                    <Input
                                        {...field}
                                        label="List Name"
                                        labelPlacement="outside"
                                        placeholder="e.g. Q1 Premium Retargeting"
                                        variant="flat"
                                        isInvalid={!!errors.name}
                                        errorMessage={errors.name?.message}
                                        isDisabled={isLoading}
                                        classNames={{ inputWrapper: "bg-default-100/50 border-none" }}
                                        isRequired
                                    />
                                )}
                            />

                            <Controller
                                name="remarks"
                                control={control}
                                render={({ field }) => (
                                    <Textarea
                                        {...field}
                                        label="Description"
                                        labelPlacement="outside"
                                        placeholder="What is this list for?"
                                        variant="flat"
                                        isInvalid={!!errors.remarks}
                                        errorMessage={errors.remarks?.message}
                                        isDisabled={isLoading}
                                        minRows={2}
                                        classNames={{ inputWrapper: "bg-default-100/50 border-none" }}
                                    />
                                )}
                            />
                        </div>

                        {/* --- Section 2: Source Selection (only for creation) --- */}
                        {!isEditing && (
                            <div className="flex flex-col gap-3">
                                <label className="text-sm font-medium text-default-700">Creation Method</label>
                                <Controller
                                    name="source"
                                    control={control}
                                    render={({ field }) => (
                                        <RadioGroup
                                            {...field}
                                            orientation="horizontal"
                                            isDisabled={isLoading}
                                            classNames={{ wrapper: "grid grid-cols-1 sm:grid-cols-2 gap-4" }}
                                        >
                                            <CustomRadio value="MANUAL" description="Add customers one by one manually">
                                                Manual Entry
                                            </CustomRadio>
                                            <CustomRadio value="CSV_UPLOAD" description="Import bulk data from a file">
                                                CSV Upload
                                            </CustomRadio>
                                        </RadioGroup>
                                    )}
                                />
                            </div>
                        )}

                        {/* --- Section 3: Conditional File Upload --- */}
                        {!isEditing && sourceValue === "CSV_UPLOAD" && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    id="csv-file-input"
                                />
                                <label htmlFor="csv-file-input" className="cursor-pointer group">
                                    <div className={cn(
                                        "relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all",
                                        csvFile
                                            ? "border-success-200 bg-success-50/30"
                                            : "border-default-200 bg-default-50 group-hover:bg-default-100 group-hover:border-secondary-300"
                                    )}>
                                        {!csvFile ? (
                                            <>
                                                <div className="p-3 rounded-full bg-white shadow-sm mb-3 group-hover:scale-110 transition-transform">
                                                    <Upload size={24} className="text-secondary" />
                                                </div>
                                                <p className="text-sm font-semibold">Click to upload CSV</p>
                                                <p className="text-xs text-default-400 mt-1">Max size 10MB (UTF-8 encoding)</p>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-4 w-full">
                                                <div className="p-3 rounded-xl bg-success text-white">
                                                    <FileText size={24} />
                                                </div>
                                                <div className="flex flex-col flex-1 overflow-hidden">
                                                    <span className="text-sm font-bold truncate">{csvFile.name}</span>
                                                    <span className="text-tiny text-default-500">{(csvFile.size / 1024).toFixed(1)} KB • Ready to import</span>
                                                </div>
                                                <Button isIconOnly size="sm" variant="light" className="text-default-400">
                                                    <CheckCircle2 size={20} className="text-success" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </label>
                            </div>
                        )}

                        {/* --- Section 4: Advanced Settings (only in settings mode) --- */}
                        {showAdvancedSettings && (
                            <div className="flex flex-col gap-4">
                                <label className="text-xs font-medium text-default-400">Advanced Settings</label>
                                <Controller
                                    name="primaryKey"
                                    control={control}
                                    render={({ field }) => (
                                        <Select
                                            {...field}
                                            label="Primary Key"
                                            labelPlacement="outside"
                                            placeholder="Select a field"
                                            variant="flat"
                                            description="The field used to match and upsert existing records"
                                            isDisabled={isLoading || fieldKeys.length === 0}
                                            classNames={{ 
                                                trigger: "bg-default-100/50 border-none",
                                                base: "mt-0!",
                                            }}
                                            selectedKeys={field.value ? new Set([field.value]) : new Set()}
                                            onSelectionChange={(keys) => {
                                                const selected = Array.from(keys)[0];
                                                field.onChange(selected || "");
                                            }}
                                        >
                                            {fieldKeys.map((key) => (
                                                <SelectItem key={key}>
                                                    {key}
                                                </SelectItem>
                                            ))}
                                        </Select>
                                    )}
                                />
                            </div>
                        )}

                        <div className="p-4 rounded-xl bg-default-50 border border-default-100">
                            <div className="flex items-start gap-3">
                                <Controller
                                    name="upsertMode"
                                    control={control}
                                    render={({ field: { value, onChange, ...field } }) => (
                                        <Checkbox
                                            {...field}
                                            isDisabled={isLoading}
                                            isSelected={value}
                                            onValueChange={onChange}
                                            color="secondary"
                                            classNames={{ label: "text-tiny text-default-600 pl-2" }}
                                        >
                                            <div className="flex flex-col gap-2">
                                                <span className="font-bold text-default-800">Upsert Mode (Update existing)</span>
                                                <span>If a customer matches the Primary Key, overwrite their data instead of creating a new entry.</span>
                                            </div>
                                        </Checkbox>
                                    )}
                                />
                            </div>
                        </div>
                    </form>
                </ModalBody>

                <ModalFooter>
                        <Button
                            variant="light"
                            onPress={handleClose}
                            isDisabled={isLoading}
                            className="font-medium"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form="customer-list-form"
                            color="secondary"
                            isLoading={isLoading}
                            isDisabled={!isValid || isLoading || (!isEditing && sourceValue === "CSV_UPLOAD" && !csvFile)}
                            startContent={!isLoading && (isEditing ? <Plus size={18} /> : <Plus size={18} />)}
                        >
                            {isEditing ? "Save Changes" : "Create List"}
                        </Button>
                    </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default CreateCustomerListModal;
