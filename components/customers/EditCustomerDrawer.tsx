"use client"
import React from "react";
import { 
  Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, 
  Button, Input, Divider 
} from "@heroui/react";
import { Controller, useForm } from "react-hook-form";
import { Save, X } from "lucide-react";
import { useAppSelector } from "@/store/hooks";

export const EditCustomerDrawer = ({ isOpen, onClose, onOpenChange, customerId, fields, onSave }: {
    isOpen: boolean;
    onClose: () => void;
    onOpenChange?: (open: boolean) => void;
    customerId: string;
    fields: Array<{ key: string; label: string }>;
    onSave: (data: Record<string, any>) => void;
}) => {

    const customerState = useAppSelector((state) => state.listCustomers);
    const customer = customerState.items.find(c => c.id === customerId);

    // Initialize form with the customer's existing JSON data
    const { control, handleSubmit } = useForm({
        defaultValues: customer?.data
    });

    return (
        <Drawer isOpen={isOpen} onClose={onClose} onOpenChange={onOpenChange} size="md" backdrop="opaque">
            <DrawerContent>
                {(onClose) => (
                    <form onSubmit={handleSubmit(onSave)} className="flex flex-col h-full">
                        <DrawerHeader className="flex flex-col gap-1">
                            <h2 className="text-xl font-bold">Edit Customer</h2>
                            <p className="text-tiny text-default-400 font-normal">
                                Update information for {customer?.data?.name || "this contact"}
                            </p>
                        </DrawerHeader>
                        
                        <Divider />

                        <DrawerBody className="py-6 flex flex-col gap-6">
                            {/* Dynamically render inputs based on List Schema */}
                            {fields.map((field: any) => (
                                <Controller
                                    key={field.key}
                                    name={field.key}
                                    control={control}
                                    render={({ field: inputField }) => (
                                        <Input
                                            {...inputField}
                                            label={field.label}
                                            labelPlacement="outside"
                                            placeholder={`Enter ${field.label.toLowerCase()}`}
                                            variant="bordered"
                                            fullWidth
                                        />
                                    )}
                                />
                            ))}
                        </DrawerBody>

                        <Divider />

                        <DrawerFooter className="gap-2 bg-default-50/50">
                            <Button variant="light" onPress={onClose} className="font-medium">
                                Cancel
                            </Button>
                            <Button 
                                color="secondary" 
                                className="bg-[#7828C8] px-8 font-bold" 
                                type="submit"
                                startContent={<Save size={18} />}
                            >
                                Save Changes
                            </Button>
                        </DrawerFooter>
                    </form>
                )}
            </DrawerContent>
        </Drawer>
    );
};