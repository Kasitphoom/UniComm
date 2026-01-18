"use client"
import React, { useEffect, useMemo, useState } from "react"
import { 
    Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
    Spinner, Button, Pagination, Selection, Tooltip, Divider
} from "@heroui/react"
import { EditIcon, Trash2, Plus, Search } from "lucide-react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { fetchListCustomers } from "@/features/customers/listCustomersSlice"
import { useSearchParams, useRouter } from "next/navigation"
import CustomersControlBar from "./CustomersControlBar"
import { ListCustomersState } from "@/features/customers/types"

type Props = { id: string }

const CustomersTable: React.FC<Props> = ({ id }) => {
    const searchParams = useSearchParams()
    const router = useRouter()
    const dispatch = useAppDispatch()
    
    const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set([]));

    const query = searchParams.get("query") || ""
    const page = parseInt(searchParams.get("page") || "1", 10) || 1
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10) || 20

    const { contactList, items, status, totalPages } = useAppSelector((s) => s.listCustomers) as ListCustomersState

    useEffect(() => {
        if (!id) return
        dispatch(fetchListCustomers({ id, page, pageSize, query }))
    }, [dispatch, id, page, pageSize, query])

    // --- Dynamic Column Logic ---
    const columns = useMemo(() => {
        const fields = (contactList?.fields as any[] | undefined) || []
        const fromFields = fields.map((f) => {
            const key = typeof f === "string" ? f : (f?.name || f?.key || f?.id || f?.field || "value")
            const label = typeof f === "string" ? f : (f?.label || f?.title || key)
            return { key, label }
        })

        if (fromFields.length > 0) return fromFields

        // Fallback to keys from first item data when no fields are defined
        const firstData = items[0]?.data
        if (firstData && typeof firstData === "object" && !Array.isArray(firstData)) {
            return Object.keys(firstData).map((k) => ({ key: k, label: k }))
        }

        // No columns available yet
        return []
    }, [contactList?.fields, items])

    // --- Selection Logic ---
    const selectionCount = selectedKeys === "all" ? items.length : selectedKeys.size;
    const isEditDisabled = selectionCount !== 1;
    const isDeleteDisabled = selectionCount === 0;

    const setPage = (next: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("page", String(next))
        router.replace(`?${params.toString()}`)
    }

    return (
        <div className="flex flex-col gap-0 w-full bg-white rounded-2xl border border-default-100 shadow-sm overflow-hidden">
            
            {/* --- 1. ALWAYS VISIBLE TOOLBAR --- */}
            <div className="flex flex-col sm:flex-row justify-between items-center p-4 gap-4 bg-white">
                <div className="flex items-center gap-2">
                    <Button 
                        size="sm" 
                        variant="flat" 
                        color="primary"
                        isDisabled={isEditDisabled}
                        startContent={<EditIcon size={16} />}
                    >
                        Edit
                    </Button>
                    <Button 
                        size="sm" 
                        variant="flat" 
                        color="danger"
                        isDisabled={isDeleteDisabled}
                        startContent={<Trash2 size={16} />}
                    >
                        Delete {selectionCount > 1 ? `(${selectionCount})` : ""}
                    </Button>
                </div>

                <CustomersControlBar />
            </div>

            <Divider />

            {/* --- 2. THE SCROLLABLE TABLE AREA --- */}
            {/* overflow-x-auto enables sliding. min-w-max or a fixed px forces the scrollbar */}
            <div className="w-full overflow-x-auto">
                {columns.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-default-400 text-sm">No fields to display.</div>
                ) : (
                    <Table 
                        aria-label="Customers list table"
                        selectionMode="multiple"
                        selectedKeys={selectedKeys}
                        onSelectionChange={setSelectedKeys}
                        removeWrapper
                        className="min-w-300"
                        classNames={{
                            th: "bg-default-50 text-default-500 text-tiny uppercase font-bold py-4 px-6",
                            td: "py-4 px-6 border-b border-default-50 last:border-none text-small",
                        }}
                    >
                        <TableHeader columns={columns}>
                            {(column) => (
                                <TableColumn key={column.key}>
                                    {column.label}
                                </TableColumn>
                            )}
                        </TableHeader>
                        <TableBody 
                            items={items} 
                            emptyContent="No customers found."
                            isLoading={status === "loading"}
                        >
                            {(item) => (
                                <TableRow key={item.id}>
                                    {(columnKey) => (
                                        <TableCell>
                                            {(() => {
                                                const val = (item.data as any)?.[columnKey as string]
                                                if (val === null || val === undefined) return "-"
                                                if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") return String(val)
                                                try { return JSON.stringify(val) } catch { return "-" }
                                            })()}
                                        </TableCell>
                                    )}
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </div>

            <Divider />

            {/* --- 3. PAGINATION (TABLE END SECTION) --- */}
            <div className="flex w-full justify-between items-center p-4 bg-default-50/50">
                <span className="text-tiny text-default-400">
                    Showing {items.length} results
                </span>
                <Pagination
                    isCompact
                    showControls
                    color="secondary"
                    page={page}
                    total={totalPages}
                    onChange={setPage}
                    classNames={{
                        cursor: "bg-[#7828C8] text-white"
                    }}
                />
            </div>
        </div>
    )
}

export default CustomersTable