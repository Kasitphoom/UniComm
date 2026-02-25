import type { PDFRenderProps, Plugin, Schema, getDefaultFont } from "@pdfme/common"
import { createSvgStr } from "@pdfme/schemas/utils"
import { text as textPlugin } from "@pdfme/schemas"
import { Type } from "lucide"
import type { UIRenderProps } from "@pdfme/common"
import { TextWithVariablesPropPanel } from "./propPanel"

export type TextWithVariablesSchema = Schema & {
    fontName?: string
    alignment?: "left" | "center" | "right" | "justify"
    verticalAlignment?: "top" | "middle" | "bottom"
    fontSize?: number
    lineHeight?: number
    strikethrough?: boolean
    underline?: boolean
    characterSpacing?: number
    dynamicFontSize?: {
        min: number
        max: number
        fit: "horizontal" | "vertical"
    }
    fontColor?: string
    backgroundColor?: string
    opacity?: number
    text?: string
    variables?: string[]
    content?: string
    readOnly?: boolean
}

type FieldOption = { field: string; type: string }
type FieldGroup = {
    listId: string
    listName: string
    fields: FieldOption[]
}
type DropdownFieldEntry = {
    field: string
    type: string
    sourceListName: string
}

let cachedFieldGroups: FieldGroup[] | null = null
let cachedFieldGroupsPromise: Promise<FieldGroup[]> | null = null

const fetchAllCustomerListFields = async (): Promise<FieldGroup[]> => {
    if (cachedFieldGroups) return cachedFieldGroups
    if (cachedFieldGroupsPromise) return cachedFieldGroupsPromise

    cachedFieldGroupsPromise = (async () => {
        const response = await fetch('/api/customer-list/fields', {
            credentials: 'include',
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch customer list fields: ${response.statusText}`)
        }

        const payload = (await response.json()) as {
            groups?: Array<{
                listId?: unknown
                listName?: unknown
                fields?: Array<{ field?: unknown; type?: unknown }>
            }>
        }
        const groups = Array.isArray(payload.groups)
            ? payload.groups
                .filter((group): group is { listId: string; listName: string; fields?: Array<{ field?: unknown; type?: unknown }> } =>
                    typeof group?.listId === 'string' &&
                    typeof group?.listName === 'string',
                )
                .map((group) => ({
                    listId: group.listId,
                    listName: group.listName,
                    fields: Array.isArray(group.fields)
                        ? group.fields
                            .filter((item): item is { field: string; type: string } =>
                                typeof item?.field === 'string' &&
                                item.field.trim().length > 0 &&
                                typeof item?.type === 'string',
                            )
                            .map((item) => ({ field: item.field.trim(), type: item.type }))
                        : [],
                }))
            : []

        cachedFieldGroups = groups
        return groups
    })()

    try {
        return await cachedFieldGroupsPromise
    } finally {
        cachedFieldGroupsPromise = null
    }
}

// Parse text content and replace variables with actual values
const parseVariables = (text: string, data?: Record<string, any>): string => {
    if (typeof text !== "string") return text
    
    // Match {{fieldName}} patterns and replace with values
    let result = text
    if (data) {
        Object.keys(data).forEach((fieldName) => {
            const regex = new RegExp(`\\{\\{\\s*${fieldName.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*\\}\\}`, 'g')
            result = result.replace(regex, String(data[fieldName]))
        })
    }
    
    // Remove any unreplaced variables (show field name without braces)
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, fieldName) => fieldName.trim())
    
    return result
}

// Extract all variable names from text (e.g., ["firstName", "lastName"])
export const extractVariables = (text: string): string[] => {
    if (typeof text !== "string") return []
    const matches = text.matchAll(/\{\{([^}]+)\}\}/g)
    return Array.from(new Set(Array.from(matches, m => m[1].trim()).filter(Boolean)))
}

// Make element plain text contenteditable (supports Firefox)
const makeElementPlainTextContentEditable = (element: HTMLElement) => {
    const isFirefox = () => navigator.userAgent.toLowerCase().indexOf('firefox') > -1
    
    if (!isFirefox()) {
        element.contentEditable = 'plaintext-only'
        return
    }

    element.contentEditable = 'true'
    element.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            document.execCommand('insertLineBreak', false, undefined)
        }
    })

    element.addEventListener('paste', (e: ClipboardEvent) => {
        e.preventDefault()
        const paste = e.clipboardData?.getData('text')
        const selection = window.getSelection()
        if (!selection?.rangeCount) return
        selection.deleteFromDocument()
        selection.getRangeAt(0).insertNode(document.createTextNode(paste || ''))
        selection.collapseToEnd()
    })
}



const TextWithVariables: Plugin<TextWithVariablesSchema> = {
    pdf: async (arg: PDFRenderProps<TextWithVariablesSchema>) => {
        const { schema, value, ...rest } = arg

        // Get the text content with variables replaced
        const rawText = schema.text || ""
        // Parse value - it could be a string (JSON) or already an object
        let valueData: Record<string, any> | undefined
        if (typeof value === 'string' && value) {
            try {
                valueData = JSON.parse(value)
            } catch {
                valueData = undefined
            }
        } else if (typeof value === 'object' && value !== null) {
            valueData = value as Record<string, any>
        }
        const processedText = parseVariables(rawText, valueData)

        await textPlugin.pdf({
            value: processedText,
            schema: schema as unknown as Parameters<typeof textPlugin.pdf>[0]['schema'],
            ...rest,
        })
    },

    ui: async (arg: UIRenderProps<TextWithVariablesSchema>) => {
        const { rootElement, schema, onChange, mode, value, tabIndex, placeholder, stopEditing, theme } = arg

        // Get text from schema.text
        const rawText = schema.text || ""
        
        // Extract variables from text and update schema if needed
        const variables = extractVariables(rawText)
        const currentVariables = Array.isArray(schema.variables) ? schema.variables : []
        if (mode === 'designer' && JSON.stringify(variables) !== JSON.stringify(currentVariables)) {
            if (onChange) {
                onChange({ key: 'variables', value: variables })
            }
        }

        // Form mode - do not render inputs; keep variables as-is

        // Parse value - it could be a string (JSON) or already an object
        let valueData: Record<string, any> | undefined
        if (typeof value === 'string' && value) {
            try {
                valueData = JSON.parse(value)
            } catch {
                valueData = undefined
            }
        } else if (typeof value === 'object' && value !== null) {
            valueData = value as Record<string, any>
        }

        // In designer mode, show raw text with {{variables}}; otherwise render with data
        const isEditableMode = mode === 'designer'
        const displayText = isEditableMode ? rawText : parseVariables(rawText, valueData)

        // Clear root element
        rootElement.innerHTML = ''

        // Create container
        const container = document.createElement("div")
        container.style.width = "100%"
        container.style.height = "100%"
        container.style.display = "flex"
        container.style.flexDirection = "column"
        if (schema.verticalAlignment === "middle") {
            container.style.justifyContent = "center"
        } else if (schema.verticalAlignment === "bottom") {
            container.style.justifyContent = "flex-end"
        } else {
            container.style.justifyContent = "flex-start"
        }
        container.style.padding = "0"
        container.style.boxSizing = "border-box"
        container.style.cursor = isEditableMode ? "text" : "default"
        container.style.border = "none"
        container.style.background = schema.backgroundColor || "transparent"
        container.style.opacity = typeof schema.opacity === "number" ? String(schema.opacity) : "1"
        rootElement.appendChild(container)

        // Create text element
        const textBlock = document.createElement("div")
        textBlock.id = `text-${schema.id}`
        textBlock.style.width = "100%"
        textBlock.style.fontFamily = schema.fontName || "sans-serif"
        textBlock.style.fontSize = `${schema.fontSize || 12}pt`
        textBlock.style.color = schema.fontColor || "#000000"
        textBlock.style.textAlign = schema.alignment || "left"
        if (typeof schema.lineHeight === "number") {
            textBlock.style.lineHeight = String(schema.lineHeight)
        }
        if (typeof schema.characterSpacing === "number") {
            textBlock.style.letterSpacing = `${schema.characterSpacing}pt`
        }
        if (schema.underline || schema.strikethrough) {
            const decorations = [
                schema.underline ? "underline" : "",
                schema.strikethrough ? "line-through" : "",
            ].filter(Boolean)
            textBlock.style.textDecoration = decorations.join(" ")
        }
        textBlock.style.whiteSpace = "pre-wrap"
        textBlock.style.wordBreak = "break-word"
        textBlock.style.outline = "none"
        textBlock.style.border = "none"
        textBlock.style.resize = "none"
        textBlock.style.margin = "0"
        textBlock.style.padding = "0"
        container.appendChild(textBlock)

        if (!isEditableMode) {
            // Read-only mode - just display the text
            textBlock.textContent = displayText
            return
        }

        // Editable mode - make contenteditable
        makeElementPlainTextContentEditable(textBlock)
        textBlock.tabIndex = tabIndex || 0
        textBlock.innerText = rawText

        // Helper to get clean text
        const getText = (element: HTMLDivElement) => {
            let text = element.innerText
            if (text.endsWith('\n')) {
                text = text.slice(0, -1)
            }
            return text
        }

        const getCaretOffset = (element: HTMLDivElement) => {
            const selection = window.getSelection()
            if (!selection || selection.rangeCount === 0) return 0
            const range = selection.getRangeAt(0)
            const preRange = range.cloneRange()
            preRange.selectNodeContents(element)
            preRange.setEnd(range.startContainer, range.startOffset)
            return preRange.toString().length
        }

        const setCaretOffset = (element: HTMLDivElement, offset: number) => {
            const selection = window.getSelection()
            if (!selection) return
            const range = document.createRange()
            let current = 0
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
            let node: Node | null = null
            while ((node = walker.nextNode())) {
                const length = node.textContent?.length || 0
                if (current + length >= offset) {
                    range.setStart(node, Math.max(0, offset - current))
                    range.collapse(true)
                    selection.removeAllRanges()
                    selection.addRange(range)
                    return
                }
                current += length
            }

            range.selectNodeContents(element)
            range.collapse(false)
            selection.removeAllRanges()
            selection.addRange(range)
        }

        // Handle blur event - save text and update variables
        textBlock.addEventListener('blur', (e: Event) => {
            const newText = getText(e.target as HTMLDivElement)
            const newVariables = extractVariables(newText)
            
            if (onChange) {
                // Update both text and variables
                onChange([
                    { key: 'text', value: newText },
                    { key: 'variables', value: newVariables }
                ])
            }
        })

        // Focus in designer mode
        if (mode === 'designer') {
            setTimeout(() => {
                textBlock.focus()
                const selection = window.getSelection()
                const range = document.createRange()
                if (selection && range) {
                    range.selectNodeContents(textBlock)
                    range.collapse(false)
                    selection.removeAllRanges()
                    selection.addRange(range)
                }
            })
        }

        // Variable dropdown functionality
        if (mode === 'designer') {
            let dropdown: HTMLDivElement | null = null
            let fieldGroups: FieldGroup[] = []
            let selectedIndex = -1
            let dropdownItems: HTMLDivElement[] = []
            let selectableFieldEntries: DropdownFieldEntry[] = []

            // Fetch all available fields across customer lists
            const fetchFields = async () => {
                try {
                    fieldGroups = await fetchAllCustomerListFields()
                } catch (err) {
                    console.error("Failed to fetch customer list fields:", err)
                }
            }

            fetchFields()

            const updateSelectedItem = (index: number) => {
                // Clear previous selection
                dropdownItems.forEach(item => {
                    item.style.backgroundColor = "transparent"
                })

                if (index >= 0 && index < dropdownItems.length) {
                    selectedIndex = index
                    dropdownItems[selectedIndex].style.backgroundColor = "#e6f7ff"
                    
                    // Scroll into view if needed
                    dropdownItems[selectedIndex].scrollIntoView({
                        block: 'nearest',
                        behavior: 'smooth'
                    })
                }
            }

            const showDropdown = (filterText: string = "") => {
                if (dropdown) hideDropdown()

                dropdown = document.createElement("div")
                dropdown.style.position = "fixed"
                dropdown.style.backgroundColor = "white"
                dropdown.style.border = "1px solid #d9d9d9"
                dropdown.style.borderRadius = "8px"
                dropdown.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)"
                dropdown.style.maxHeight = "200px"
                dropdown.style.overflowY = "auto"
                dropdown.style.zIndex = "10000"
                dropdown.style.minWidth = "150px"

                // Position dropdown near cursor
                const selection = window.getSelection()
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0)
                    const rect = range.getBoundingClientRect()
                    dropdown.style.left = `${rect.left}px`
                    dropdown.style.top = `${rect.bottom + 5}px`
                }

                const normalizedFilter = filterText.trim().toLowerCase()
                const filteredGroups = fieldGroups
                    .map((group) => ({
                        ...group,
                        fields: group.fields.filter((f) =>
                            f.field.toLowerCase().includes(normalizedFilter),
                        ),
                    }))
                    .filter((group) => group.fields.length > 0)

                dropdownItems = []
                selectedIndex = -1
                selectableFieldEntries = []

                if (filteredGroups.length === 0) {
                    const emptyMsg = document.createElement("div")
                    emptyMsg.textContent = "No fields available"
                    emptyMsg.style.padding = "8px 12px"
                    emptyMsg.style.fontSize = "12px"
                    emptyMsg.style.color = "#999"
                    dropdown.appendChild(emptyMsg)
                } else {
                    filteredGroups.forEach((group) => {
                        const groupHeader = document.createElement('div')
                        groupHeader.textContent = group.listName
                        groupHeader.style.padding = '6px 12px'
                        groupHeader.style.fontSize = '11px'
                        groupHeader.style.fontWeight = '600'
                        groupHeader.style.color = '#666'
                        groupHeader.style.backgroundColor = '#fafafa'
                        groupHeader.style.borderTop = '1px solid #f0f0f0'
                        groupHeader.style.borderBottom = '1px solid #f0f0f0'
                        dropdown?.appendChild(groupHeader)

                        group.fields.forEach((field) => {
                            const item = document.createElement("div")
                            const currentItemIndex = dropdownItems.length
                            item.style.padding = "8px 12px"
                            item.style.cursor = "pointer"
                            item.style.fontSize = "12px"
                            item.style.borderBottom = "1px solid #f5f5f5"
                            item.style.transition = "background-color 0.15s"
                            item.style.display = 'flex'
                            item.style.justifyContent = 'space-between'
                            item.style.gap = '12px'

                            const fieldLabel = document.createElement('span')
                            fieldLabel.textContent = field.field
                            fieldLabel.style.color = '#111'

                            const sourceLabel = document.createElement('span')
                            sourceLabel.textContent = group.listName
                            sourceLabel.style.color = '#888'
                            sourceLabel.style.fontSize = '11px'

                            item.appendChild(fieldLabel)
                            item.appendChild(sourceLabel)

                            item.onmouseenter = () => {
                                selectedIndex = currentItemIndex
                                updateSelectedItem(currentItemIndex)
                            }
                            item.onmouseleave = () => {
                                item.style.backgroundColor = selectedIndex === currentItemIndex ? "#e6f7ff" : "transparent"
                            }
                            item.onmousedown = (e) => {
                                e.preventDefault()
                                const selectedEntry = selectableFieldEntries[currentItemIndex]
                                if (selectedEntry) {
                                    insertVariable(selectedEntry.field)
                                }
                            }

                            dropdownItems.push(item)
                            selectableFieldEntries.push({
                                field: field.field,
                                type: field.type,
                                sourceListName: group.listName,
                            })
                            dropdown?.appendChild(item)
                        })
                    })

                    // Auto-select first item
                    if (dropdownItems.length > 0) {
                        updateSelectedItem(0)
                    }
                }

                document.body.appendChild(dropdown)
            }

            const hideDropdown = () => {
                if (dropdown && document.body.contains(dropdown)) {
                    document.body.removeChild(dropdown)
                    dropdown = null
                    dropdownItems = []
                    selectableFieldEntries = []
                    selectedIndex = -1
                }
            }

            const insertVariable = (fieldName: string) => {
                const selection = window.getSelection()
                if (!selection || !selection.rangeCount) return

                const textContent = getText(textBlock)
                const cursorPos = getCaretOffset(textBlock)

                // Find the "{{" before cursor
                let startPos = cursorPos
                const beforeCursor = textContent.substring(0, cursorPos)
                const lastBracePos = beforeCursor.lastIndexOf("{{")
                
                if (lastBracePos !== -1) {
                    startPos = lastBracePos
                }

                // Create new text with variable inserted
                const beforeVar = textContent.substring(0, startPos)
                const afterVar = textContent.substring(cursorPos)
                const newText = beforeVar + `{{${fieldName}}}` + afterVar
                
                textBlock.innerText = newText
                
                if (onChange) {
                    onChange({ key: 'text', value: newText })
                }
                
                hideDropdown()
                textBlock.focus()
                
                // Set cursor after the inserted variable
                const newCursorPos = startPos + `{{${fieldName}}}`.length
                setCaretOffset(textBlock, newCursorPos)
            }

            let lastText = rawText
            textBlock.addEventListener('input', () => {
                const currentText = textBlock.textContent || ''
                const selection = window.getSelection()
                if (!selection || !selection.rangeCount) return
                
                const cursorPos = selection.getRangeAt(0).startOffset
                const textBefore = currentText.substring(0, cursorPos)
                
                // Check if user just typed "{{"
                if (textBefore.endsWith("{{") && !lastText.endsWith("{{")) {
                    showDropdown("")
                } else if (textBefore.includes("{{") && !textBefore.substring(textBefore.lastIndexOf("{{")).includes("}}")) {
                    // User is typing inside {{ }}
                    const startIdx = textBefore.lastIndexOf("{{")
                    const filterText = textBefore.substring(startIdx + 2)
                    showDropdown(filterText)
                } else {
                    hideDropdown()
                }
                
                lastText = currentText
            })

            textBlock.addEventListener('blur', () => {
                setTimeout(hideDropdown, 200)
            })

            // Keyboard navigation for dropdown
            textBlock.addEventListener('keydown', (e) => {
                // If dropdown is visible, handle navigation
                if (dropdown && dropdownItems.length > 0) {
                    switch (e.key) {
                        case 'ArrowDown':
                            e.preventDefault()
                            const nextIndex = selectedIndex < dropdownItems.length - 1 ? selectedIndex + 1 : 0
                            updateSelectedItem(nextIndex)
                            break
                        
                        case 'ArrowUp':
                            e.preventDefault()
                            const prevIndex = selectedIndex > 0 ? selectedIndex - 1 : dropdownItems.length - 1
                            updateSelectedItem(prevIndex)
                            break
                        
                        case 'Enter':
                        case 'Tab':
                            if (selectedIndex >= 0 && selectedIndex < dropdownItems.length) {
                                e.preventDefault()
                                const selectedField = selectableFieldEntries[selectedIndex]?.field
                                if (selectedField) {
                                    insertVariable(selectedField)
                                }
                            }
                            break
                        
                        case 'Escape':
                            e.preventDefault()
                            hideDropdown()
                            break
                    }
                } else if (e.key === 'Escape') {
                    // Close dropdown even if no items
                    hideDropdown()
                }
            })
        }
    },

    propPanel: TextWithVariablesPropPanel,
    icon: createSvgStr(Type),
    uninterruptedEditMode: true,
}

export default TextWithVariables
