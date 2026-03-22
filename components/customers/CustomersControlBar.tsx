"use client"
import React, { useState } from "react"
import { Button } from "@heroui/react"
import SearchBar from "@/components/SearchBar"
import { PlusIcon, Settings } from "lucide-react"
import CreateCustomerListModal from "./CreateCustomerListModal"
import AddCustomerModal from "./AddCustomerModal"
import { useAppSelector } from "@/store/hooks"
import { useUserHasPermissionClient } from "@/utils/permissions"
import { UserRole } from "@/app/generated/business/prisma"

interface CustomersControlBarProps {
    listId?: string;
}

const CustomersControlBar: React.FC<CustomersControlBarProps> = ({ listId }) => {
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
    const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false)
    const listCustomers = useAppSelector((state) => state.listCustomers)
    const userHasPermission = useUserHasPermissionClient([ UserRole.OWNER, UserRole.ADMIN ]);

    return (
        <>
            <div className="flex flex-col gap-3 justify-end md:flex-row md:items-center">
                <div className="flex gap-3">
                    <Button isIconOnly variant="ghost" startContent={<Settings size={16} />} onPress={() => setIsSettingsModalOpen(true)} />
                    <SearchBar props={{
                        classNames: {
                            inputWrapper: "border-2! border-default-300",
                        }
                    }} />
                    </div>
                <Button color="secondary" className="shrink-0" startContent={<PlusIcon size={16} />} onPress={() => setIsAddCustomerModalOpen(true)} isDisabled={!userHasPermission}>Add Customer</Button>
            </div>

            <CreateCustomerListModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                showAdvancedSettings={true}
                listToEdit={listCustomers.contactList || undefined}
            />

            {listId && (
                <AddCustomerModal
                    isOpen={isAddCustomerModalOpen}
                    onClose={() => setIsAddCustomerModalOpen(false)}
                    listId={listId}
                />
            )}
        </>
    )
}

export default CustomersControlBar
