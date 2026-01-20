"use client";

import React from "react";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Divider,
    ButtonProps,
} from "@heroui/react";

type AnswerButtonConfig = {
    name: string;
    onPress: () => void;
    color?: "primary" | "secondary" | "success" | "warning" | "danger" | "default";
    isLoading?: boolean;
    variant?: "solid" | "bordered" | "flat" | "light" | "ghost" | "faded";
};

interface ConfirmDialogProps {
    isOpen: boolean;
    title: React.ReactNode;
    content: React.ReactNode;
    onCancel: () => void;
    onConfirm?: () => void;
    confirmButtonProps?: ButtonProps;
    confirmText?: string;
    cancelText?: string;
    isConfirmLoading?: boolean;
    requireAnswer?: boolean;
    answerButtonConfig?: AnswerButtonConfig;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    content,
    onCancel,
    onConfirm,
    confirmButtonProps,
    confirmText = "Confirm",
    cancelText = "Cancel",
    isConfirmLoading = false,
    requireAnswer = false,
    answerButtonConfig,
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onCancel} backdrop="blur">
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">{title}</ModalHeader>
                <Divider />
                <ModalBody>
                    <div className="text-sm text-foreground-600 leading-relaxed">
                        {content}
                    </div>
                </ModalBody>
                <Divider />
                <ModalFooter className="flex flex-wrap gap-2">
                    <Button variant="light" onPress={onCancel}>
                        {cancelText}
                    </Button>
                    {requireAnswer && answerButtonConfig && (
                        <Button
                            color={answerButtonConfig.color || "warning"}
                            variant={answerButtonConfig.variant || "flat"}
                            onPress={answerButtonConfig.onPress}
                            isLoading={answerButtonConfig.isLoading}
                        >
                            {answerButtonConfig.name}
                        </Button>
                    )}
                    {onConfirm && (
                        <Button
                            {...confirmButtonProps}
                            color={confirmButtonProps?.color || "secondary"}
                            onPress={onConfirm}
                            isLoading={isConfirmLoading}
                        >
                            {confirmText}
                        </Button>
                    )}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default ConfirmDialog;
