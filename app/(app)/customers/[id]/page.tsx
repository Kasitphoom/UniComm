import CustomersControlBar from "@/components/customers/CustomersControlBar"
import CustomersTable from "@/components/customers/CustomersTable"
import { getBusinessPrismaByCookie } from "@/lib/prisma-business"
import { notFound } from "next/navigation"
import { isValidObjectId } from "@/utils/objectId"

export default async function CustomersListPage({ params }: { params: { id: string } }) {
    const { id } = await params

    if (!id || !isValidObjectId(id)) {
        notFound()
    }

    const prisma = await getBusinessPrismaByCookie()
    const contactList = await prisma.contactList.findUnique({
        where: { id },
        select: { name: true, remarks: true },
    })

    if (!contactList) {
        notFound()
    }

    return (
        <div className="p-6 space-y-6">
            <div className='flex flex-col gap-2'>
                <h1 className='font-bold text-xl'>{contactList.name}</h1>
                <p className="text-default-400 text-small">{contactList.remarks || ""}</p>
            </div>

            <CustomersTable id={id} />
        </div>
    )
}
