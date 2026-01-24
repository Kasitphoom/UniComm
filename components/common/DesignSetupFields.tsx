'use client'
import React, { useEffect } from 'react'
import { Controller, type Control, type FieldErrors, type UseFormSetValue, type UseFormWatch } from 'react-hook-form'
import { Divider, Input, Select, SelectItem, type Selection } from '@heroui/react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchCustomerLists } from '@/features/customers/customerListsSlice'

export const PAPER_SIZES = [
	{ label: 'A4', value: 'a4', widthCm: 21.0, heightCm: 29.7 },
	{ label: 'Letter', value: 'letter', widthCm: 21.59, heightCm: 27.94 },
	{ label: 'Legal', value: 'legal', widthCm: 21.59, heightCm: 35.56 },
	{ label: 'Custom', value: 'custom', widthCm: 0, heightCm: 0 },
] as const
export type PaperSize = typeof PAPER_SIZES[number]['value']

export const ORIENTATIONS = [
	{ label: 'Portrait', value: 'portrait' },
	{ label: 'Landscape', value: 'landscape' },
] as const
export type Orientation = typeof ORIENTATIONS[number]['value']

type Props<TFieldValues extends Record<string, any>> = {
	control: Control<TFieldValues>
	errors: FieldErrors<TFieldValues>
	setValue: UseFormSetValue<TFieldValues>
	watch: UseFormWatch<TFieldValues>
	nameField: keyof TFieldValues
	nameLabel: string
	externalErrorMessage?: string | null
}

function DesignSetupFields<TFieldValues extends Record<string, any>>({
	control,
	errors,
	setValue,
	watch,
	nameField,
	nameLabel,
	externalErrorMessage,
}: Props<TFieldValues>) {
	const dispatch = useAppDispatch()
	const presetFor = (value: PaperSize) => PAPER_SIZES.find(p => p.value === value)

	const paperSize = watch('paperSize' as any) as PaperSize
	const width = watch('widthCm' as any) as string
	const height = watch('heightCm' as any) as string

	const { status: customerListStatus, items: customerList } = useAppSelector(state => state.customerLists.list);

	const tryAutoSelectPreset = (wStr: string, hStr: string) => {
		const w = parseFloat(wStr)
		const h = parseFloat(hStr)
		if (Number.isFinite(w) && Number.isFinite(h)) {
			const match = PAPER_SIZES.find(p => p.value !== 'custom' && Math.abs(p.widthCm - w) < 0.01 && Math.abs(p.heightCm - h) < 0.01)
			if (match) {
				setValue('paperSize' as any, match.value as any, { shouldValidate: true })
				return
			}
		}
		setValue('paperSize' as any, 'custom' as any, { shouldValidate: true })
	}

	useEffect(() => {
		if (customerListStatus === 'idle' && customerList.length <= 0) {
			dispatch(fetchCustomerLists())
		}
	}, [customerListStatus, customerList])

	return (
		<>
			<Controller
				name={nameField as any}
				control={control}
				render={({ field }) => (
					<Input
						{...field}
						value={field.value}
						onValueChange={field.onChange}
						label={nameLabel}
						placeholder={`Enter ${nameLabel.toLowerCase()}`}
						labelPlacement='outside'
						isInvalid={!!(errors as any)[nameField] || !!externalErrorMessage}
						errorMessage={(errors as any)[nameField]?.message || (externalErrorMessage ? JSON.parse(externalErrorMessage || '{}').error : undefined)}
						autoComplete='off'
						isRequired
					/>
				)}
			/>
			<Controller
				name={"customerListId" as any}
				control={control}
				render={({ field }) => (
					<Select
						label='Customer List'
						selectionMode='single'
						selectedKeys={new Set([field.value])}
						onSelectionChange={(keys: Selection) => {
							if (keys === 'all') return
							const key = Array.from(keys)[0] as string | undefined
							if (key) field.onChange(key)
						}}
						labelPlacement='outside'
						placeholder='Select Customer List (Optional)'
					>
						{customerList.map((option) => (
							<SelectItem key={option.id}>{option.name}</SelectItem>
						))}
					</Select>
				)}
			/>
			<Divider />
			<Controller
				name={'paperSize' as any}
				control={control}
				render={({ field }) => (
					<Select
						label='Paper Size'
						selectionMode='single'
						selectedKeys={new Set([field.value])}
						onSelectionChange={(keys: Selection) => {
							if (keys === 'all') return
							const key = Array.from(keys)[0] as PaperSize | undefined
							if (!key) return
							field.onChange(key)
							const preset = presetFor(key)
							if (preset && key !== 'custom') {
								setValue('widthCm' as any, String(preset.widthCm) as any, { shouldValidate: true })
								setValue('heightCm' as any, String(preset.heightCm) as any, { shouldValidate: true })
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
					name={'widthCm' as any}
					control={control}
					render={({ field }) => (
						<Input
							label='Width (cm)'
							value={paperSize === 'custom' ? field.value : String(presetFor(paperSize as PaperSize)?.widthCm ?? '')}
							onValueChange={(val) => {
								field.onChange(val)
								tryAutoSelectPreset(val, height)
							}}
							isInvalid={!!(errors as any).widthCm}
							errorMessage={(errors as any).widthCm?.message}
						/>
					)}
				/>
				<Controller
					name={'heightCm' as any}
					control={control}
					render={({ field }) => (
						<Input
							label='Height (cm)'
							value={paperSize === 'custom' ? field.value : String(presetFor(paperSize as PaperSize)?.heightCm ?? '')}
							onValueChange={(val) => {
								field.onChange(val)
								tryAutoSelectPreset(width, val)
							}}
							isInvalid={!!(errors as any).heightCm}
							errorMessage={(errors as any).heightCm?.message}
						/>
					)}
				/>
			</div>
			<Controller
				name={'orientation' as any}
				control={control}
				render={({ field }) => (
					<Select
						label='Orientation'
						selectionMode='single'
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
		</>
	)
}

export default DesignSetupFields
