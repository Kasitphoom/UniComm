"use client"

import { Button } from "@heroui/react"
import { UserPlusIcon } from "lucide-react"
import SearchBar from "../SearchBar"

const ControlBar = () => {
    return (
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
                >
                Invite User
            </Button>
        </div>
    )
}

export default ControlBar