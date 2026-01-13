"use client";

import React, { useEffect } from "react";
import {
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    User,
    Chip,
    Tooltip,
    Spinner,
    Pagination,
    Card,
    CardBody,
    Button,
} from "@heroui/react";
import { EditIcon, DeleteIcon, CalendarIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchUsers } from "@/features/users/usersSlice";
import type { BusinessUser } from "@/features/users/types";

const columns = [
    { name: "NAME", uid: "name" },
    { name: "ROLE", uid: "role" },
    { name: "JOINED AT", uid: "joinedAt" },
    { name: "ACTIONS", uid: "actions" },
];

const getRoleColor = (role: BusinessUser['role']) => {
    switch (role) {
        case 'OWNER':
            return 'secondary';
        case 'ADMIN':
            return 'primary';
        case 'MEMBER':
            return 'default';
        case 'AUDITOR':
            return 'warning';
        default:
            return 'default';
    }
};

export default function UserList() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const dispatch = useAppDispatch();
    const { items: users, status, error, currentPage, totalPages } = useAppSelector((state) => state.users.list);

    const query = searchParams.get("query") || "";
    const sort = (searchParams.get("sort") || "desc") as "asc" | "desc";
    const page = parseInt(searchParams.get("page") || "1", 10);

    useEffect(() => {
        dispatch(fetchUsers({ query: query || undefined, page, perPage: 10, sort }));
    }, [dispatch, query, page, sort]);

    const onPageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", newPage.toString());
        router.push(`?${params.toString()}`);
    };

    const onSortChange = (descriptor: { column?: string | number; direction: "ascending" | "descending" }) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("sort", descriptor.direction === "ascending" ? "asc" : "desc");
        params.set("page", "1");
        router.push(`?${params.toString()}`);
    };

    const renderCell = React.useCallback((user: BusinessUser, columnKey: React.Key) => {
        switch (columnKey) {
            case "name":
                return (
                    <User
                        avatarProps={{ 
                            radius: "lg",
                            name: user.displayName?.toUpperCase() || user.email?.charAt(0).toUpperCase()
                        }}
                        description={user.email}
                        name={user.displayName || user.email}
                    >
                        {user.email}
                    </User>
                );
            case "role":
                return (
                    <Chip
                        className="capitalize"
                        color={getRoleColor(user.role)}
                        size="sm"
                        variant="flat"
                    >
                        {user.role}
                    </Chip>
                );
            case "joinedAt":
                const date = new Date(user.createdAt).toLocaleDateString()
                return (
                    <p className="text-foreground-400">{date}</p>
                );
            case "actions":
                return (
                    <div className="relative flex items-center justify-center gap-2">
                        <Tooltip content="Edit user">
                            <span className="text-lg text-default-400 cursor-pointer active:opacity-50">
                                <EditIcon size={20} />
                            </span>
                        </Tooltip>
                        <Tooltip color="danger" content="Delete user">
                            <span className="text-lg text-danger cursor-pointer active:opacity-50">
                                <DeleteIcon size={20} />
                            </span>
                        </Tooltip>
                    </div>
                );
            default:
                return null;
        }
    }, []);

    if (status === 'loading') {
        return (
            <div className="flex justify-center items-center min-h-100">
                <Spinner color="secondary" size="lg" />
            </div>
        );
    }

    if (status === 'failed') {
        return (
            <div className="flex justify-center items-center min-h-100 text-danger">
                <p>Error loading users: {error}</p>
            </div>
        );
    }

    // Shared sub-components for Mobile Cards
    const MobileUserCard = ({ user }: { user: BusinessUser }) => (
        <Card className="mb-3 shadow-sm border-none bg-white lg:hidden">
            <CardBody className="p-4">
                <div className="flex justify-between items-start mb-3">
                    <User
                        avatarProps={{
                            radius: "lg",
                            name: user.displayName?.toUpperCase() || user.email?.charAt(0).toUpperCase()
                        }}
                        description={user.email}
                        name={user.displayName || user.email}
                    />
                    <Chip
                        className="capitalize"
                        color={getRoleColor(user.role)}
                        size="sm"
                        variant="flat"
                    >
                        {user.role}
                    </Chip>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-divider">
                    <div className="flex items-center gap-1 text-tiny text-default-400">
                        <CalendarIcon size={12} />
                        {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex gap-3">
                        <Button isIconOnly size="sm" variant="light" aria-label="Edit">
                            <EditIcon size={18} className="text-default-400" />
                        </Button>
                        <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Delete">
                            <DeleteIcon size={18} />
                        </Button>
                    </div>
                </div>
            </CardBody>
        </Card>
    );

    return (
        <div className="space-y-4">
            {/* Desktop View: Only visible on large screens */}
            <div className="hidden lg:block">
                <Table
                    aria-label="User Management Table"
                    isHeaderSticky
                    classNames={{
                        base: "max-h-[600px]",
                        table: "min-w-[600px]",
                    }}
                    sortDescriptor={{ column: "name", direction: sort === "asc" ? "ascending" : "descending" }}
                    onSortChange={onSortChange}
                >
                    <TableHeader columns={columns}>
                        {(column) => (
                            <TableColumn
                                key={column.uid}
                                align={column.uid === "actions" ? "center" : "start"}
                                allowsSorting={column.uid === "name"}
                            >
                                {column.name}
                            </TableColumn>
                        )}
                    </TableHeader>
                    <TableBody items={users}>
                        {(item: BusinessUser) => (
                            <TableRow key={item.id}>
                                {(columnKey) => (
                                    <TableCell>{renderCell(item, columnKey)}</TableCell>
                                )}
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile View: Only visible on small/medium screens */}
            <div className="lg:hidden">
                {users.map((user: BusinessUser) => (
                    <MobileUserCard key={user.id} user={user} />
                ))}
            </div>

            {/* Shared Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center mt-6">
                    <Pagination
                        color="secondary"
                        page={currentPage}
                        total={totalPages}
                        onChange={onPageChange}
                        // Adjust size for mobile
                        size={typeof window !== 'undefined' && window.innerWidth < 640 ? "sm" : "md"}
                        classNames={{
                            item: 'bg-white',
                        }}
                    />
                </div>
            )}
        </div>
    );
}