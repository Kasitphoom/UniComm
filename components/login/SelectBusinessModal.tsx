'use client'
import APICallHandler from '@/utils/apiCall';
import { addToast, Modal, ModalBody, ModalContent, ModalHeader, Spinner } from '@heroui/react';
import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import { BusinessListResponse, BusinessWithMembershipsDTO } from '@/types/business';
import { ChevronRight, Briefcase, Mail } from 'lucide-react';

interface SelectBusinessModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

const SelectBusinessModal = (props: SelectBusinessModalProps) => {

    const { update } = useSession();
    const router = useRouter();
    const pathname = usePathname();

    const [businesses, setBusinesses] = useState<BusinessWithMembershipsDTO[]>();
    const [loading, setLoading] = useState(false);
    const [switchingBusinessId, setSwitchingBusinessId] = useState<string | null>(null);

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

    const handleSelectBusiness = async (id: string) => {
        if (switchingBusinessId) return;
        setSwitchingBusinessId(id);

        try {
            await APICallHandler('/api/business/active', 'POST', { businessId: id });
            await update({ activeBusinessId: id, user: { activeBusinessId: id } } as any);
            props.onOpenChange(false);

            const isAuthPage = pathname === '/' || pathname?.startsWith('/login');
            if (isAuthPage) {
                router.push('/dashboard');
            } else {
                router.refresh();
            }
        } catch {
            addToast({
                title: 'Unable to switch business',
                description: 'Please try again.',
                color: 'danger',
            });
        } finally {
            setSwitchingBusinessId(null);
        }
    }

    return (
        <Modal 
            backdrop='blur' 
            isOpen={props.isOpen}
            onOpenChange={props.onOpenChange}
            size='lg'
            classNames={{
                body: "bg-content1",
                base: "bg-content1 dark:bg-content1 border border-default-100 shadow-xl",
                header: "border-b border-default-100 pb-4",
                closeButton: "hover:bg-default-100 active:bg-default-200",
            }}
            motionProps={{
                variants: {
                    enter: {
                        y: 0,
                        opacity: 1,
                        transition: {
                            duration: 0.3,
                            ease: "easeOut",
                        },
                    },
                    exit: {
                        y: -20,
                        opacity: 0,
                        transition: {
                            duration: 0.2,
                            ease: "easeIn",
                        },
                    },
                }
            }}
        >
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 px-6 pt-6">
                    <div className="flex items-center gap-3">
                        <div>
                            <span className="text-xl font-semibold">Select Workspace</span>
                            <p className="text-sm font-normal text-default-500 mt-0.5">
                                Choose a business account to continue
                            </p>
                        </div>
                    </div>
                </ModalHeader>
                <ModalBody className="px-6 py-6 scrollbar-hide">
                    {
                        loading ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <Spinner size="lg" color='secondary' />
                                <p className="text-sm text-default-400 animate-pulse">Loading your workspaces...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {businesses && businesses.length > 0 ? (
                                    <>
                                        <div className="grid gap-3 max-h-100 overflow-y-auto pr-1">
                                            {businesses.map((business) => {
                                                const membership = business.memberships?.find((b) => b.businessId === business.id);
                                                const role = membership?.role;
                                                const isSwitching = switchingBusinessId === business.id;
                                                
                                                return (
                                                    <div 
                                                        key={business.id} 
                                                        className="group relative flex items-center justify-between p-4 border border-default-200 rounded-xl hover:border-secondary hover:bg-secondary-50/10 cursor-pointer transition-all duration-200 bg-content2/50 hover:shadow-sm"
                                                        onClick={() => handleSelectBusiness(business.id as string)}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-default-100/50 text-default-500 group-hover:bg-secondary group-hover:text-white transition-colors duration-200">
                                                                <Briefcase size={18} />
                                                            </div>
                                                            <div className="flex flex-col text-left">
                                                                <h3 className="font-semibold text-default-900 group-hover:text-secondary transition-colors">{business.name}</h3>
                                                                {role && (
                                                                    <span className="text-xs text-default-400 font-medium bg-default-100 rounded-md px-2 py-0.5 w-fit mt-1 uppercase tracking-wide">
                                                                        {role}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {isSwitching ? (
                                                            <Spinner size="sm" color="secondary" />
                                                        ) : (
                                                            <ChevronRight className="text-default-300 group-hover:text-secondary transform group-hover:translate-x-1 transition-all duration-200" size={20} />
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <div className="mt-2 pt-4 border-t border-default-100 flex justify-center">
                                            <p className="text-xs text-default-400">
                                                Looking for another organization? Contact your admin.
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="h-16 w-16 bg-default-50 rounded-full flex items-center justify-center mb-4">
                                            <Mail className="text-default-300" size={32} />
                                        </div>
                                        <h3 className="text-lg font-medium text-default-900 mb-1">No Workspaces Found</h3>
                                        <p className="text-sm text-default-500 max-w-65">
                                            You haven't been added to any business workspaces yet.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )
                    }
                </ModalBody>
            </ModalContent>
        </Modal>
    )
}

export default SelectBusinessModal