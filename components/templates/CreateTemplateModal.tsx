'use client'
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import React from 'react'
import { useForm } from 'react-hook-form'
import * as yup from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'
import { createTemplate } from '@/features/templates/templatesSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { usePathname, useRouter } from 'next/navigation';
import { setSidebarOpen } from '@/features/ui/uiSlice';
import DesignSetupFields, { Orientation, PaperSize, PAPER_SIZES, ORIENTATIONS } from '@/components/common/DesignSetupFields'

interface SelectBusinessModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

// Reuse enums from shared fields

type FormValues = {
    templateName: string
    paperSize: PaperSize
    orientation: Orientation
    widthCm: string
    heightCm: string
}

const schema: yup.ObjectSchema<FormValues> = yup
    .object({
        templateName: yup
            .string()
            .trim()
            .min(1, 'Template name is required')
            .max(100, 'Max 100 characters')
            .required('Template name is required'),
        paperSize: yup
            .mixed<PaperSize>()
            .oneOf(PAPER_SIZES.map(p => p.value) as PaperSize[])
            .required(),
        orientation: yup
            .mixed<Orientation>()
            .oneOf(ORIENTATIONS.map(o => o.value) as Orientation[])
            .required(),
        widthCm: yup
            .string()
            .when('paperSize', {
                is: (ps: PaperSize) => ps === 'custom',
                then: (s) => s
                    .required('Width is required')
                    .test('is-number', 'Must be a number', (v) => v !== undefined && v !== null && v !== '' && !Number.isNaN(parseFloat(String(v))))
                    .test('positive', 'Must be greater than 0', (v) => parseFloat(String(v)) > 0),
                otherwise: (s) => s.defined(),
            })
            .defined(),
        heightCm: yup
            .string()
            .when('paperSize', {
                is: (ps: PaperSize) => ps === 'custom',
                then: (s) => s
                    .required('Height is required')
                    .test('is-number', 'Must be a number', (v) => v !== undefined && v !== null && v !== '' && !Number.isNaN(parseFloat(String(v))))
                    .test('positive', 'Must be greater than 0', (v) => parseFloat(String(v)) > 0),
                otherwise: (s) => s.defined(),
            })
            .defined(),
    })
    .required()

const CreateTemplateModal = (props: SelectBusinessModalProps) => {
    const dispatch = useAppDispatch()
    const pathname = usePathname()
    const router = useRouter()
    const { error } = useAppSelector(state => state.templates.detail)
    const {
        control,
        handleSubmit,
        setValue,
        watch,
        formState: { isValid, isSubmitting, errors },
    } = useForm<FormValues>({
        mode: 'onChange',
        resolver: yupResolver(schema),
        defaultValues: {
            templateName: '',
            paperSize: 'a4',
            orientation: 'portrait',
            widthCm: '21.0',
            heightCm: '29.7',
        },
    })

    const onSubmit = async (data: FormValues) => {
        try {
            const createdTemplate = await dispatch(createTemplate(data)).unwrap()
            router.push(`${pathname}/${createdTemplate.id}`)
            dispatch(setSidebarOpen(false))
            props.onOpenChange(false)
        } catch (err) {
            // Optionally surface error to the user; keeping console for now
            console.error('Failed to create template:', err)
        }
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
                <form onSubmit={handleSubmit(onSubmit)}>
                    <ModalHeader className="flex flex-col gap-1 border-b border-default-300">Create Template</ModalHeader>
                    <ModalBody>
                        <DesignSetupFields
                            control={control}
                            errors={errors}
                            setValue={setValue}
                            watch={watch}
                            nameField={'templateName'}
                            nameLabel={'Template Name'}
                            externalErrorMessage={error}
                        />
                    </ModalBody>
                    <ModalFooter className='flex justify-end border-t border-default-300 gap-2'>
                        <Button 
                            type='button'
                            variant='light' 
                            color='danger' 
                            onPress={() => props.onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button 
                            type='submit' 
                            color='secondary' 
                            isDisabled={!isValid || isSubmitting}
                            isLoading={isSubmitting}
                        >
                            Create
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    )
}

export default CreateTemplateModal