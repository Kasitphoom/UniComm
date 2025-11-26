'use client'
import { Button, Divider, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, type Selection } from '@heroui/react';
import React from 'react'
import { Controller, useForm } from 'react-hook-form'
import * as yup from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'
import { createTemplate } from '@/features/templates/templatesSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { usePathname, useRouter } from 'next/navigation';
import { setSidebarOpen } from '@/features/ui/uiSlice';

interface SelectBusinessModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

const PAPER_SIZES = [
    { label: 'A4', value: 'a4', widthCm: 21.0, heightCm: 29.7 },
    { label: 'Letter', value: 'letter', widthCm: 21.59, heightCm: 27.94 },
    { label: 'Legal', value: 'legal', widthCm: 21.59, heightCm: 35.56 },
    { label: 'Custom', value: 'custom', widthCm: 0, heightCm: 0 },
] as const
type PaperSize = typeof PAPER_SIZES[number]['value']

const ORIENTATIONS = [
    { label: 'Portrait', value: 'portrait' },
    { label: 'Landscape', value: 'landscape' },
] as const
type Orientation = typeof ORIENTATIONS[number]['value']

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

    const paperSize = watch('paperSize')
    const width = watch('widthCm')
    const height = watch('heightCm')
    const orientation = watch('orientation')

    const presetFor = (value: PaperSize) => PAPER_SIZES.find(p => p.value === value)

    const tryAutoSelectPreset = (wStr: string, hStr: string) => {
        const w = parseFloat(wStr)
        const h = parseFloat(hStr)
        if (Number.isFinite(w) && Number.isFinite(h)) {
            const match = PAPER_SIZES.find(p => p.value !== 'custom' && Math.abs(p.widthCm - w) < 0.01 && Math.abs(p.heightCm - h) < 0.01)
            if (match) {
                setValue('paperSize', match.value, { shouldValidate: true })
                return
            }
        }
        setValue('paperSize', 'custom', { shouldValidate: true })
    }

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
                        <Controller
                            name="templateName"
                            control={control}
                            render={({ field }) => (
                                <Input
                                    {...field}
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    label="Template Name"
                                    placeholder="Enter template name"
                                    labelPlacement='outside'
                                    isInvalid={!!errors.templateName || !!error}
                                    errorMessage={errors.templateName?.message || JSON.parse(error || "{}").error}
                                    autoComplete='off'
                                />
                            )}
                        />
                        <Divider />
                        <Controller
                            name="paperSize"
                            control={control}
                            render={({ field }) => (
                                <Select 
                                    label="Paper Size" 
                                    selectionMode="single"
                                    selectedKeys={new Set([field.value])}
                                    onSelectionChange={(keys: Selection) => {
                                        if (keys === 'all') return
                                        const key = Array.from(keys)[0] as PaperSize | undefined
                                        if (!key) return
                                        field.onChange(key)
                                        const preset = presetFor(key)
                                        if (preset && key !== 'custom') {
                                            setValue('widthCm', String(preset.widthCm), { shouldValidate: true })
                                            setValue('heightCm', String(preset.heightCm), { shouldValidate: true })
                                        }
                                    }}
                                    labelPlacement='outside'
                                >
                                    {PAPER_SIZES.map((option) => (
                                        <SelectItem key={option.value}>{option.label}</SelectItem>
                                    ))}
                                </Select>
                            )}
                        />
                        <div className='flex gap-2'>
                            <Controller
                                name="widthCm"
                                control={control}
                                render={({ field }) => (
                                    <Input
                                        label="Width (cm)"
                                        value={paperSize === 'custom' ? field.value : String(presetFor(paperSize)?.widthCm ?? '')}
                                        onValueChange={(val) => {
                                            field.onChange(val)
                                            tryAutoSelectPreset(val, height)
                                        }}
                                        isInvalid={!!errors.widthCm}
                                        errorMessage={errors.widthCm?.message}
                                    />
                                )}
                            />
                            <Controller
                                name="heightCm"
                                control={control}
                                render={({ field }) => (
                                    <Input
                                        label="Height (cm)"
                                        value={paperSize === 'custom' ? field.value : String(presetFor(paperSize)?.heightCm ?? '')}
                                        onValueChange={(val) => {
                                            field.onChange(val)
                                            tryAutoSelectPreset(width, val)
                                        }}
                                        isInvalid={!!errors.heightCm}
                                        errorMessage={errors.heightCm?.message}
                                    />
                                )}
                            />
                        </div>
                        <Controller
                            name="orientation"
                            control={control}
                            render={({ field }) => (
                                <Select 
                                    label="Orientation" 
                                    selectionMode="single"
                                    selectedKeys={new Set([field.value])}
                                    onSelectionChange={(keys: Selection) => {
                                        if (keys === 'all') return
                                        const key = Array.from(keys)[0] as Orientation | undefined
                                        if (key) field.onChange(key)
                                    }}
                                    labelPlacement='outside'
                                >
                                    {ORIENTATIONS.map((option) => (
                                        <SelectItem key={option.value}>{option.label}</SelectItem>
                                    ))}
                                </Select>
                            )}
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