'use client'
import APICallHandler from '@/utils/apiCall';
import { Modal, ModalBody, ModalContent, ModalHeader, Spinner } from '@heroui/react';
import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { BusinessListResponse, BusinessWithMembershipsDTO } from '@/types/business';

interface SelectBusinessModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

const SelectBusinessModal = (props: SelectBusinessModalProps) => {

    const { update } = useSession();
    const router = useRouter();

    const [businesses, setBusinesses] = useState<BusinessWithMembershipsDTO[]>();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Fetch businesses from API when modal is opened
        if (props.isOpen) {
            getUserBusinesses();
        }
    }, [props.isOpen]);

    const getUserBusinesses = async () => {
        setLoading(true);
        const businessResponse: BusinessListResponse = await APICallHandler('/api/business', 'GET')
        setBusinesses(businessResponse.businesses);
        setLoading(false);
    }

    return (
        <Modal 
            backdrop='blur' 
            isOpen={props.isOpen}
            onOpenChange={props.onOpenChange}
            size='lg'
            classNames={{
                body: "py-4 px-4"
            }}
        >
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">Select Business</ModalHeader>
                <ModalBody>
                    {
                        loading ? (
                            <Spinner color='secondary' />
                        ) : (
                            <div className="flex flex-col gap-4">
                                {businesses && businesses.map((business) => (
                                    <div 
                                        key={business.id} 
                                        className="py-2 px-4 border border-default-200 rounded-lg hover:bg-default-100 cursor-pointer"
                                        onClick={() => {
                                            // Persist cookie for server-side redirects, update session token, then soft-navigate
                                            const id = business.id as string
                                            document.cookie = `uc_default_business=${encodeURIComponent(id)}; Path=/; Max-Age=${60 * 60 * 24 * 365}`
                                            update({ activeBusinessId: id })
                                                .then(() => {
                                                    router.replace(`/dashboard`)
                                                })
                                                .catch(() => {})
                                        }}
                                    >
                                        <h3 className="font-medium">{business.name}</h3>
                                        <p className="text-sm text-default-400">{business.memberships?.find((b) => b.businessId === business.id)?.role}</p>
                                    </div>
                                ))}
                            </div>
                        )
                    }
                </ModalBody>
            </ModalContent>
        </Modal>
    )
}

export default SelectBusinessModal