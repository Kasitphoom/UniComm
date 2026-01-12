"use client";

import React from "react";
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
} from "@heroui/react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { UserRole } from "@/app/generated/business/prisma";

// Create validation schema
const inviteUserSchema = yup.object().shape({
    email: yup
        .string()
        .required("Email is required")
        .email("Please enter a valid email address"),
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

type InviteUserFormData = yup.InferType<typeof inviteUserSchema>;

// Get role options from Prisma enum
const roleOptions = Object.values(UserRole).map((role) => ({
    value: role,
    label: role.charAt(0) + role.slice(1).toLowerCase(),
}));

interface InviteUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const InviteUserModal: React.FC<InviteUserModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
}) => {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<InviteUserFormData>({
        resolver: yupResolver(inviteUserSchema),
        defaultValues: {
            email: "",
            displayName: "",
            role: UserRole.MEMBER,
        },
    });

    const onSubmit = async (data: InviteUserFormData) => {
        setIsSubmitting(true);
        setErrorMessage(null);

        try {
            const response = await fetch("/api/business/invite", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to send invitation");
            }

            // Success - reset form and close modal
            reset();
            onClose();
            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "An error occurred while sending the invitation"
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        reset();
        setErrorMessage(null);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            backdrop="blur"
        >
            <ModalContent>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <ModalHeader className="flex flex-col gap-1">
                        Invite User
                    </ModalHeader>
                    <ModalBody>
                        {errorMessage && (
                            <div className="p-3 rounded-lg bg-danger-50 text-danger">
                                {errorMessage}
                            </div>
                        )}

                        <Controller
                            name="email"
                            control={control}
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    type="email"
                                    label="Email"
                                    placeholder="Enter user's email"
                                    variant="bordered"
                                    isInvalid={!!errors.email}
                                    errorMessage={errors.email?.message}
                                    isDisabled={isSubmitting}
                                />
                            )}
                        />

                        <Controller
                            name="displayName"
                            control={control}
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    type="text"
                                    label="Display Name"
                                    placeholder="Enter user's display name"
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
                                        <SelectItem key={role.value} value={role.value}>
                                            {role.label}
                                        </SelectItem>
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
                        <Button
                            color="secondary"
                            type="submit"
                            isLoading={isSubmitting}
                        >
                            Send Invitation
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
};

export default InviteUserModal;
