"use client"
import React, { useState } from "react"
import { Button } from "@heroui/react"
import SearchBar from "@/components/SearchBar"
import { PlusIcon, Settings } from "lucide-react"
import CreateCustomerListModal from "./CreateCustomerListModal"
import { useAppSelector } from "@/store/hooks"

const CustomersControlBar: React.FC = () => {
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
    const listCustomers = useAppSelector((state) => state.listCustomers)

    return (
        <>
            <div className="flex flex-col gap-3 justify-end md:flex-row md:items-center">
                <Button isIconOnly variant="ghost" startContent={<Settings size={16} />} onPress={() => setIsSettingsModalOpen(true)} />
                <SearchBar props={{
                    classNames: {
                        inputWrapper: "border-2! border-default-300",
                    }
                }} />
                <Button color="secondary" className="shrink-0" startContent={<PlusIcon size={16} />}>Add Customer</Button>
            </div>

            <CreateCustomerListModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                showAdvancedSettings={true}
                listToEdit={listCustomers.contactList || undefined}
            />
        </>
    )
}

export default CustomersControlBar
