'use client'

import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import * as yup from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, type Selection } from '@heroui/react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchCustomerLists } from '@/features/customers/customerListsSlice'
import { updateTemplateSettings } from '@/features/templates/templatesSlice'
import { clientFetchTemplate } from '@/utils/template/utils'
import { userHasPermissionClient } from '@/utils/permissions'
import { useUser } from '../providers/UserProvider'
import { TemplateWithUser } from '@/types/template'

interface TemplateSettingsModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    templateId: string
}

type FormValues = {
    title: string
    contactListId?: string | null
}

const schema: yup.ObjectSchema<FormValues> = yup
    .object({
        title: yup
            .string()
            .trim()
            .min(1, 'Title is required')
            .max(100, 'Max 100 characters')
            .required('Title is required'),
        contactListId: yup.string().nullable().optional(),
    })
    .required()

const TemplateSettingsModal = ({
    isOpen,
    onOpenChange,
    templateId,
}: TemplateSettingsModalProps) => {
    const dispatch = useAppDispatch()
    const user = useUser()
    const { items: contactLists, status: contactListStatus } = useAppSelector((state) => state.customerLists.list)
    const { error: templateError } = useAppSelector((state) => state.templates.detail)
    const [template, setTemplate] = useState<TemplateWithUser | null>()
    const [isLoading, setIsLoading] = useState(false)
    
    const hasPermission = userHasPermissionClient([
        'OWNER',
        'ADMIN',
        'MEMBER',
    ])
    const isOwner = user.currentBusinessProfile?.id === template?.userId
    const canSave = hasPermission || isOwner

    const {
        control,
        handleSubmit,
        reset,
        formState: { isValid, isSubmitting, errors },
    } = useForm<FormValues>({
        mode: 'onChange',
        resolver: yupResolver(schema),
        defaultValues: {
            title: "",
            contactListId: undefined,
        },
    })

    const fetchTemplateSettings = async () => {
        setIsLoading(true)
        setTemplate(null)
        const template = await clientFetchTemplate(templateId)
        reset({
            title: template.title,
            contactListId: template.contactListId || undefined,
        })
        setTemplate(template)
        setIsLoading(false)
    }

    useEffect(() => {
        if (contactListStatus === 'idle') {
            dispatch(fetchCustomerLists())
        }
    }, [contactListStatus, dispatch])

    useEffect(() => {
        if (isOpen) {
            fetchTemplateSettings()
        }
    }, [isOpen])

    const onSubmit = async (values: FormValues) => {
        try {
            const updated = await dispatch(
                updateTemplateSettings({
                    id: templateId,
                    title: values.title.trim(),
                    contactListId: values.contactListId || null,
                })
            ).unwrap()
            reset({
                title: updated.title,
                contactListId: updated.contactListId || undefined,
            })
            onOpenChange(false)
        } catch (err) {
            console.error('Failed to update template settings:', err)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            backdrop="blur"
            size='lg'
        >
            <ModalContent>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <ModalHeader className="flex flex-col gap-1 border-b border-default-300">
                        Template Settings
                    </ModalHeader>
                    <ModalBody className="gap-4 py-4">
                        <Controller
                            name="title"
                            control={control}
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    label="Title"
                                    placeholder="Enter title"
                                    labelPlacement="outside"
                                    isInvalid={!!errors.title || !!templateError}
                                    errorMessage={errors.title?.message || (templateError ? JSON.parse(templateError || '{}').error : undefined)}
                                    autoComplete="off"
                                    isRequired
                                />
                            )}
                        />

                        <Controller
                            name="contactListId"
                            control={control}
                            render={({ field }) => (
                                <Select
                                    label="Contact List"
                                    selectionMode="single"
                                    selectedKeys={field.value ? new Set([field.value]) : new Set([])}
                                    onSelectionChange={(keys: Selection) => {
                                        if (keys === 'all') return
                                        const key = Array.from(keys)[0] as string | undefined
                                        field.onChange(key || null)
                                    }}
                                    labelPlacement="outside"
                                    placeholder="Select contact list (optional)"
                                    isLoading={contactListStatus === 'loading'}
                                >
                                    {contactLists.map((list) => (
                                        <SelectItem key={list.id}>{list.name}</SelectItem>
                                    ))}
                                </Select>
                            )}
                        />
                    </ModalBody>
                    <ModalFooter className="flex justify-end border-t border-default-300 gap-2">
                        <Button
                            type="button"
                            variant="light"
                            color="danger"
                            onPress={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            color="secondary"
                            isDisabled={!isValid || isSubmitting || isLoading || !canSave}
                            isLoading={isSubmitting}
                        >
                            Save
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    )
}

export default TemplateSettingsModal
