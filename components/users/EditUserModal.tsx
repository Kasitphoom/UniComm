"use client";

import React, { useEffect, useState } from "react";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
    Select,
    SelectItem,
    addToast,
} from "@heroui/react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { UserRole } from "@/app/generated/business/prisma";
import type { BusinessUser } from "@/features/users/types";
import { useAppDispatch } from "@/store/hooks";
import { updateUser } from "@/features/users/usersSlice";

const editUserSchema = yup.object().shape({
    displayName: yup
        .string()
        .required("Display name is required")
        .min(2, "Display name must be at least 2 characters")
        .max(50, "Display name must not exceed 50 characters"),
    role: yup
        .string()
        .required("Role is required")
        .oneOf(Object.values(UserRole), "Invalid role selected"),
});

const roleOptions = Object.values(UserRole).map((role) => ({
    value: role,
    label: role.charAt(0) + role.slice(1).toLowerCase(),
}));

interface EditUserModalProps {
    isOpen: boolean;
    user: BusinessUser | null;
    onClose: () => void;
    onSuccess?: (user: BusinessUser) => void;
}

type EditUserFormData = yup.InferType<typeof editUserSchema>;

const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, user, onClose, onSuccess }) => {
    const dispatch = useAppDispatch();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<EditUserFormData>({
        resolver: yupResolver(editUserSchema),
        defaultValues: {
            displayName: user?.displayName || "",
            role: user?.role || UserRole.MEMBER,
        },
    });

    useEffect(() => {
        if (user) {
            reset({
                displayName: user.displayName || "",
                role: user.role,
            });
        }
    }, [user, reset]);

    const onSubmit = async (data: EditUserFormData) => {
        if (!user) return;
        setIsSubmitting(true);
        setErrorMessage(null);

        try {
            const updated = await dispatch(
                updateUser({
                    id: user.id,
                    displayName: data.displayName,
                    role: data.role as BusinessUser["role"],
                })
            ).unwrap();

            addToast({
                title: "User updated",
                description: `${updated.displayName || updated.email} has been updated.`,
                color: "secondary",
            });

            reset({ displayName: updated.displayName || "", role: updated.role });
            onClose();
            if (onSuccess) onSuccess(updated);
        } catch (err: any) {
            setErrorMessage(err?.message || "Failed to update user");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (user) {
            reset({
                displayName: user.displayName || "",
                role: user.role,
            });
        }
        setErrorMessage(null);
        onClose();
    };

    return (
        <Modal isOpen={isOpen && !!user} onClose={handleClose} backdrop="blur">
            <ModalContent>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <ModalHeader className="flex flex-col gap-1">Edit User</ModalHeader>
                    <ModalBody>
                        {errorMessage && (
                            <div className="p-3 rounded-lg bg-danger-50 text-danger">
                                {errorMessage}
                            </div>
                        )}

                        <Input
                            label="Email"
                            value={user?.email || ""}
                            isDisabled
                            variant="bordered"
                        />

                        <Controller
                            name="displayName"
                            control={control}
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    type="text"
                                    label="Display Name"
                                    placeholder="Enter display name"
                                    variant="bordered"
                                    isInvalid={!!errors.displayName}
                                    errorMessage={errors.displayName?.message}
                                    isDisabled={isSubmitting}
                                />
                            )}
                        />

                        <Controller
                            name="role"
                            control={control}
                            render={({ field }) => (
                                <Select
                                    {...field}
                                    label="Role"
                                    placeholder="Select a role"
                                    variant="bordered"
                                    isInvalid={!!errors.role}
                                    errorMessage={errors.role?.message}
                                    isDisabled={isSubmitting}
                                    selectedKeys={field.value ? [field.value] : []}
                                    onSelectionChange={(keys) => {
                                        const selectedKey = Array.from(keys)[0];
                                        field.onChange(selectedKey as string);
                                    }}
                                >
                                    {roleOptions.map((role) => (
                                        <SelectItem key={role.value}>{role.label}</SelectItem>
                                    ))}
                                </Select>
                            )}
                        />
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            color="danger"
                            variant="light"
                            onPress={handleClose}
                            isDisabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button color="secondary" type="submit" isLoading={isSubmitting}>
                            Save Changes
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
};

export default EditUserModal;
