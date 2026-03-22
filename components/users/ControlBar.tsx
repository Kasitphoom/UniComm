"use client"

import { useState } from "react"
import { addToast, Button } from "@heroui/react"
import { UserPlusIcon } from "lucide-react"
import SearchBar from "../SearchBar"
import InviteUserModal from "./InviteUserModal"
import { useUserHasPermissionClient } from "@/utils/permissions"
import { UserRole } from "@/app/generated/business/prisma"

const ControlBar = () => {
    const [isModalOpen, setIsModalOpen] = useState(false)

    const handleInviteSuccess = () => {
        addToast({
            title: "Invitation Sent",
            description: "The user has been successfully invited.",
            color: "secondary",
        })
    }

    return (
        <>
            <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-end'>
                <div className='flex items-center gap-4'>
                    <SearchBar props={{
                        classNames: {
                            base: 'max-w-none! md:max-w-[300px]',
                        }
                    }} />
                </div>
                <Button
                    color="secondary"
                    startContent={<UserPlusIcon size={18} />}
                    onPress={() => setIsModalOpen(true)}
                    isDisabled={!useUserHasPermissionClient([UserRole.OWNER, UserRole.ADMIN])}
                >
                    Invite User
                </Button>
            </div>
            
            <InviteUserModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleInviteSuccess}
            />
        </>
    )
}

export default ControlBar