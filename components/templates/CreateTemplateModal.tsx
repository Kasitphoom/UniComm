'use client'
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, type Selection } from '@heroui/react';
import React, { useEffect, useState } from 'react'

interface SelectBusinessModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

const CreateTemplateModal = (props: SelectBusinessModalProps) => {

    const [ selectedPaperSize, setSelectedPaperSize ] = useState<Selection>(new Set(['a4']));
    const [ selectedOrientation, setSelectedOrientation ] = useState<string>('portrait');
    const [ customSize, setCustomSize ] = useState<{ widthCm: string; heightCm: string }>({ widthCm: '21.0', heightCm: '29.7' })

    const paperSizeOptions = [
        { label: 'A4', value: 'a4', widthPx: 595, heightPx: 842, widthCm: 21.0, heightCm: 29.7 },
        { label: 'Letter', value: 'letter', widthPx: 612, heightPx: 792, widthCm: 21.59, heightCm: 27.94 },
        { label: 'Legal', value: 'legal', widthPx: 612, heightPx: 1008, widthCm: 21.59, heightCm: 35.56 },
        { label: 'Custom', value: 'custom', widthPx: 0, heightPx: 0, widthCm: 0, heightCm: 0 },
    ];

    const orientationOptions = [
        { label: 'Portrait', value: 'portrait' },
        { label: 'Landscape', value: 'landscape' },
    ];

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
                <ModalHeader className="flex flex-col gap-1 border-b border-default-300">Create Template</ModalHeader>
                <ModalBody>
                    <Select 
                        label="Paper Size" 
                        selectionMode="single"
                        selectedKeys={selectedPaperSize}
                        onSelectionChange={(keys) => {
                            setSelectedPaperSize(keys)
                            if (keys === 'all') return
                            const key = Array.from(keys)[0] as string | undefined
                            if (!key) return
                            const preset = paperSizeOptions.find(o => o.value === key)
                            if (preset && preset.value !== 'custom') {
                                setCustomSize({ widthCm: String(preset.widthCm), heightCm: String(preset.heightCm) })
                            }
                        }}
                    >
                        {paperSizeOptions.map((option) => (
                            <SelectItem 
                                key={option.value}
                            >
                                {option.label}
                            </SelectItem>
                        ))}
                    </Select>
                    <div className='flex gap-2'>
                        <Input
                            label="Width (cm)"
                            value={(Array.from(selectedPaperSize as Set<string>)[0] === 'custom')
                                ? customSize.widthCm
                                : (paperSizeOptions.find(option => option.value === Array.from(selectedPaperSize as Set<string>)[0])?.widthCm.toString() || '')
                            }
                            onValueChange={(val) => {
                                const width = val
                                const height = customSize.heightCm
                                setCustomSize(prev => ({ ...prev, widthCm: width }))
                                // Decide selection: if width & height match a preset, select it; else select custom
                                const w = parseFloat(width)
                                const h = parseFloat(height)
                                const match = paperSizeOptions.find(o =>
                                    Math.abs(o.widthCm - w) < 0.01 && Math.abs(o.heightCm - h) < 0.01
                                )
                                if (isFinite(w) && isFinite(h) && match && match.value !== 'custom') {
                                    setSelectedPaperSize(new Set([match.value]))
                                } else {
                                    setSelectedPaperSize(new Set(['custom']))
                                }
                            }}
                        />
                        <Input
                            label="Height (cm)"
                            value={(Array.from(selectedPaperSize as Set<string>)[0] === 'custom')
                                ? customSize.heightCm
                                : (paperSizeOptions.find(option => option.value === Array.from(selectedPaperSize as Set<string>)[0])?.heightCm.toString() || '')
                            }
                            onValueChange={(val) => {
                                const width = customSize.widthCm
                                const height = val
                                setCustomSize(prev => ({ ...prev, heightCm: height }))
                                const w = parseFloat(width)
                                const h = parseFloat(height)
                                const match = paperSizeOptions.find(o =>
                                    Math.abs(o.widthCm - w) < 0.01 && Math.abs(o.heightCm - h) < 0.01
                                )
                                if (isFinite(w) && isFinite(h) && match && match.value !== 'custom') {
                                    setSelectedPaperSize(new Set([match.value]))
                                } else {
                                    setSelectedPaperSize(new Set(['custom']))
                                }
                            }}
                        />
                    </div>
                    <Select 
                        label="Orientation" 
                        selectionMode="single"
                        selectedKeys={new Set([selectedOrientation])}
                        onSelectionChange={(keys) => {
                            if (keys === 'all') return
                            const key = Array.from(keys)[0] as string | undefined
                            if (key) setSelectedOrientation(key)
                        }}
                    >
                        {orientationOptions.map((option) => (
                            <SelectItem 
                                key={option.value}
                            >
                                {option.label}
                            </SelectItem>
                        ))}
                    </Select>
                </ModalBody>
                <ModalFooter className='flex justify-end border-t border-default-300 gap-2'>
                    <Button variant='light' color='danger' onPress={() => props.onOpenChange(false)}>Cancel</Button>
                    <Button color='secondary' onPress={() => props.onOpenChange(false)}>Create</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    )
}

export default CreateTemplateModal