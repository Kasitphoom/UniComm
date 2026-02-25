'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as yup from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { getParsedTemplateSchema, updateTemplateSettings } from '@/features/templates/templatesSlice'
import { clientFetchParsedTemplate, clientFetchTemplate } from '@/utils/template/utils'
import { userHasPermissionClient } from '@/utils/permissions'
import { useUser } from '../providers/UserProvider'
import { TemplateWithUser } from '@/types/template'
import DesignSetupFields, { ORIENTATIONS, Orientation, PAPER_SIZES, PaperSize } from '@/components/common/DesignSetupFields'

interface TemplateSettingsModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    templateId: string
}

type FormValues = {
    title: string
    paperSize: PaperSize
    orientation: Orientation
    widthCm: string
    heightCm: string
}

const schema: yup.ObjectSchema<FormValues> = yup
    .object({
        title: yup
            .string()
            .trim()
            .min(1, 'Title is required')
            .max(100, 'Max 100 characters')
            .required('Title is required'),
        paperSize: yup
            .mixed<PaperSize>()
            .oneOf(PAPER_SIZES.map((p) => p.value) as PaperSize[])
            .required(),
        orientation: yup
            .mixed<Orientation>()
            .oneOf(ORIENTATIONS.map((o) => o.value) as Orientation[])
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

const TemplateSettingsModal = ({
    isOpen,
    onOpenChange,
    templateId,
}: TemplateSettingsModalProps) => {
    const dispatch = useAppDispatch()
    const user = useUser()
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
        setValue,
        watch,
        reset,
        formState: { isValid, isSubmitting, errors },
    } = useForm<FormValues>({
        mode: 'onChange',
        resolver: yupResolver(schema),
        defaultValues: {
            title: '',
            paperSize: 'a4',
            orientation: 'portrait',
            widthCm: '21.0',
            heightCm: '29.7',
        },
    })

    const toCm = (mm: number) => mm / 10
    const getPaperSize = (widthCm: number, heightCm: number): PaperSize => {
        const matchedPreset = PAPER_SIZES.find(
            (preset) =>
                preset.value !== 'custom' &&
                Math.abs(preset.widthCm - widthCm) < 0.01 &&
                Math.abs(preset.heightCm - heightCm) < 0.01,
        )

        return matchedPreset?.value ?? 'custom'
    }

    const fetchTemplateSettings = async () => {
        try {
            setIsLoading(true)
            setTemplate(null)

            const [templateDetail, parsedTemplate] = await Promise.all([
                clientFetchTemplate(templateId),
                clientFetchParsedTemplate(templateId),
            ])

            const basePdf = parsedTemplate.basePdf
            const baseWidthMm = typeof basePdf === 'object' && basePdf && 'width' in basePdf ? Number(basePdf.width) : 210
            const baseHeightMm = typeof basePdf === 'object' && basePdf && 'height' in basePdf ? Number(basePdf.height) : 297
            const isLandscape = baseWidthMm > baseHeightMm
            const normalizedWidthCm = isLandscape ? toCm(baseHeightMm) : toCm(baseWidthMm)
            const normalizedHeightCm = isLandscape ? toCm(baseWidthMm) : toCm(baseHeightMm)

            reset({
                title: templateDetail.title,
                paperSize: getPaperSize(normalizedWidthCm, normalizedHeightCm),
                orientation: isLandscape ? 'landscape' : 'portrait',
                widthCm: String(normalizedWidthCm),
                heightCm: String(normalizedHeightCm),
            })
            setTemplate(templateDetail)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (isOpen) {
            fetchTemplateSettings()
        }
    }, [isOpen, templateId])

    const onSubmit = async (values: FormValues) => {
        try {
            const updated = await dispatch(
                updateTemplateSettings({
                    id: templateId,
                    title: values.title.trim(),
                    paperSize: values.paperSize,
                    orientation: values.orientation,
                    widthCm: values.widthCm,
                    heightCm: values.heightCm,
                })
            ).unwrap()

            await dispatch(getParsedTemplateSchema(templateId)).unwrap()

            reset({
                title: updated.title,
                paperSize: values.paperSize,
                orientation: values.orientation,
                widthCm: values.widthCm,
                heightCm: values.heightCm,
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
                        <DesignSetupFields
                            control={control}
                            errors={errors}
                            setValue={setValue}
                            watch={watch}
                            nameField={'title'}
                            nameLabel={'Title'}
                            externalErrorMessage={templateError}
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
