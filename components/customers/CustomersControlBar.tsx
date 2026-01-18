"use client"
import React from "react"
import { Button } from "@heroui/react"
import SearchBar from "@/components/SearchBar"
import { PlusIcon } from "lucide-react"

const CustomersControlBar: React.FC = () => {
    return (
        <div className="flex flex-col gap-3 justify-end md:flex-row md:items-center">
            <SearchBar props={{ classNames: { mainWrapper: "border border-default-500 rounded-medium"} }} />
            <Button color="secondary" className="shrink-0" startContent={<PlusIcon size={16} />}>Add Customer</Button>
        </div>
    )
}

export default CustomersControlBar
