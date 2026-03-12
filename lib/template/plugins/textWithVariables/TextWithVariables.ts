import type { PDFRenderProps, Plugin, Schema } from "@pdfme/common"
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

const stripHtmlTags = (html: string): string => html.replace(/<[^>]*>/g, "")

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
    result = result.replace(/\{\{([^{}]+)\}\}/g, (match, fieldName) => fieldName.trim())
    
    return result
}

// Replace variables inside HTML while keeping markup intact
const applyVariablesToHtml = (html: string, data?: Record<string, any>): string => {
    const wrapper = document.createElement("div")
    wrapper.innerHTML = html

    const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT)
    let node: Node | null = walker.nextNode()
    while (node) {
        node.textContent = parseVariables(node.textContent || "", data)
        node = walker.nextNode()
    }

    return wrapper.innerHTML
}

// Extract all variable names from text (e.g., ["firstName", "lastName"])
export const extractVariables = (text: string): string[] => {
    if (typeof text !== "string") return []
    const matches = text.matchAll(/\{\{([^{}]+)\}\}/g)
    return Array.from(new Set(Array.from(matches, m => m[1].trim()).filter(Boolean)))
}

// Make element plain text contenteditable (supports Firefox)
const makeElementPlainTextContentEditable = (element: HTMLElement) => {
    const isFirefox = () => navigator.userAgent.toLowerCase().indexOf('firefox') > -1
    
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

        const rawContent = (schema.content && schema.content.trim().length > 0)
            ? schema.content
            : (schema.text || "")
        const rawText = stripHtmlTags(rawContent)
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

        const rawText = schema.text || ""
        const initialHtml = (schema.content && schema.content.trim().length > 0) ? schema.content : rawText
        const initialPlainText = stripHtmlTags(initialHtml)
        
        // Extract variables from text and update schema if needed
        const variables = extractVariables(initialPlainText)
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
        const displayHtml = isEditableMode
            ? initialHtml
            : (schema.content ? applyVariablesToHtml(schema.content, valueData) : parseVariables(rawText, valueData))

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
        const normalizedFontName = (schema.fontName || "").toLowerCase()
        textBlock.style.fontWeight = /bold/.test(normalizedFontName) ? "700" : "400"
        textBlock.style.fontStyle = /(italic|oblique)/.test(normalizedFontName) ? "italic" : "normal"
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
            textBlock.innerHTML = displayHtml
            return
        }

        // Editable mode - make contenteditable
        makeElementPlainTextContentEditable(textBlock)
        textBlock.tabIndex = tabIndex || 0
        textBlock.innerHTML = initialHtml

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

            const range = selection.getRangeAt(0).cloneRange()
            range.collapse(true)

            // Unique marker unlikely to exist in user text
            const markerText = "__CARET_MARKER__"
            const markerNode = document.createTextNode(markerText)

            range.insertNode(markerNode)

            const fullTextWithMarker = element.innerText
            const offset = fullTextWithMarker.indexOf(markerText)

            // Build range after marker before removing it
            const newRange = document.createRange()
            newRange.setStartAfter(markerNode)
            newRange.collapse(true)

            markerNode.parentNode?.removeChild(markerNode)

            selection.removeAllRanges()
            selection.addRange(newRange)

            return offset === -1 ? 0 : offset
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

        const findTextPosition = (
            element: HTMLDivElement,
            targetOffset: number,
        ): { node: Node; offset: number } => {
            let current = 0
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
            let node: Node | null = null

            while ((node = walker.nextNode())) {
                const length = node.textContent?.length || 0
                if (current + length >= targetOffset) {
                    return { node, offset: Math.max(0, targetOffset - current) }
                }
                current += length
            }

            return { node: element, offset: element.childNodes.length }
        }

        let lastText = getText(textBlock)

        const commitContentChange = () => {
            const plainText = getText(textBlock)
            const newVariables = extractVariables(plainText)

            if (onChange) {
                onChange([
                    { key: 'content', value: textBlock.innerHTML },
                    { key: 'text', value: plainText },
                    { key: 'variables', value: newVariables },
                ])
            }

            lastText = plainText
        }

        // Handle blur event - save text and update variables
        textBlock.addEventListener('blur', () => {
            commitContentChange()
            hideToolbar()
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
            let dropdownKeyListenerAttached = false

            // Fetch all available fields across customer lists
            const fetchFields = async () => {
                try {
                    fieldGroups = await fetchAllCustomerListFields()
                } catch (err) {
                    console.error("Failed to fetch customer list fields:", err)
                }
            }

            fetchFields()

            // Floating toolbar for inline formatting
            const toolbar = document.createElement("div")
            toolbar.style.position = "fixed"
            toolbar.style.display = "none"
            toolbar.style.backgroundColor = "#fff"
            toolbar.style.border = "1px solid #d9d9d9"
            toolbar.style.borderRadius = "8px"
            toolbar.style.boxShadow = "0 6px 16px rgba(0,0,0,0.12)"
            toolbar.style.padding = "6px 8px"
            toolbar.style.gap = "6px"
            toolbar.style.zIndex = "10001"
            toolbar.style.alignItems = "center"
            toolbar.style.whiteSpace = "nowrap"
            toolbar.style.fontSize = "12px"
            toolbar.style.lineHeight = "1"
            toolbar.style.userSelect = "none"

            const createIconButton = (label: string) => {
                const btn = document.createElement('button')
                btn.type = 'button'
                btn.textContent = label
                btn.style.border = '1px solid #d9d9d9'
                btn.style.background = '#fafafa'
                btn.style.borderRadius = '6px'
                btn.style.padding = '4px 8px'
                btn.style.cursor = 'pointer'
                btn.style.fontSize = '12px'
                btn.style.lineHeight = '1'
                btn.style.minWidth = '32px'
                btn.onmouseenter = () => btn.style.background = '#f0f0f0'
                btn.onmouseleave = () => btn.style.background = '#fafafa'
                return btn
            }

            const fontSizeDisplay = document.createElement('span')
            fontSizeDisplay.style.padding = '0 4px'
            fontSizeDisplay.style.minWidth = '36px'
            fontSizeDisplay.style.display = 'inline-block'
            fontSizeDisplay.style.textAlign = 'center'

            const getSelectionFontSize = () => {
                const selection = window.getSelection()
                const node = selection?.focusNode
                const element = (node instanceof HTMLElement ? node : node?.parentElement) || textBlock
                const computed = window.getComputedStyle(element)
                const px = parseFloat(computed.fontSize || "")
                if (Number.isNaN(px)) return schema.fontSize || 12
                return Math.max(6, Math.round(px * 0.75))
            }

            const isSelectionBold = () => {
                const selection = window.getSelection()
                const node = selection?.focusNode
                const element = (node instanceof HTMLElement ? node : node?.parentElement) || textBlock
                const weight = window.getComputedStyle(element).fontWeight
                const numericWeight = parseInt(weight, 10)
                return Number.isNaN(numericWeight) ? weight.toLowerCase() === 'bold' : numericWeight >= 600
            }

            const applyInlineStyle = (styleBuilder: (el: HTMLSpanElement) => void) => {
                const selection = window.getSelection()
                if (!selection || selection.rangeCount === 0) return
                const range = selection.getRangeAt(0)
                if (range.collapsed) return

                const wrapper = document.createElement('span')
                styleBuilder(wrapper)

                wrapper.appendChild(range.extractContents())
                range.insertNode(wrapper)

                // Keep selection at end of the styled text
                const newRange = document.createRange()
                newRange.selectNodeContents(wrapper)
                newRange.collapse(false)
                selection.removeAllRanges()
                selection.addRange(newRange)

                commitContentChange()
                updateToolbarPosition()
            }

            const updateFontSizeDisplay = () => {
                fontSizeDisplay.textContent = `${getSelectionFontSize()}pt`
            }

            const changeFontSize = (delta: number) => {
                const nextSize = Math.max(6, getSelectionFontSize() + delta)
                applyInlineStyle((el) => {
                    el.style.fontSize = `${nextSize}pt`
                })
                updateFontSizeDisplay()
            }

            const toggleBold = () => {
                const currentlyBold = isSelectionBold()
                applyInlineStyle((el) => {
                    el.style.fontWeight = currentlyBold ? '400' : '700'
                })
            }

            const hideToolbar = () => {
                toolbar.style.display = 'none'
            }

            const updateToolbarPosition = () => {
                const selection = window.getSelection()
                if (!selection || selection.rangeCount === 0) return
                const range = selection.getRangeAt(0)
                const rect = range.getBoundingClientRect()
                if (!rect || (rect.width === 0 && rect.height === 0)) return

                const offset = 8
                toolbar.style.left = `${Math.round(rect.left)}px`
                toolbar.style.top = `${Math.round(rect.top - toolbar.offsetHeight - offset)}px`
            }

            const showToolbar = () => {
                if (!document.body.contains(toolbar)) {
                    document.body.appendChild(toolbar)
                }
                toolbar.style.display = 'flex'
                updateToolbarPosition()
            }

            const handleSelectionChange = () => {
                const selection = window.getSelection()
                if (!selection || selection.rangeCount === 0) {
                    hideToolbar()
                    return
                }

                const range = selection.getRangeAt(0)
                if (!textBlock.contains(range.commonAncestorContainer) || range.collapsed) {
                    hideToolbar()
                    return
                }

                updateFontSizeDisplay()
                showToolbar()
            }

            const boldButton = createIconButton('B')
            boldButton.style.fontWeight = '700'
            boldButton.onclick = () => {
                toggleBold()
            }

            const decreaseSizeButton = createIconButton('-')
            decreaseSizeButton.onclick = () => changeFontSize(-1)

            const increaseSizeButton = createIconButton('+')
            increaseSizeButton.onclick = () => changeFontSize(1)

            toolbar.appendChild(boldButton)
            toolbar.appendChild(decreaseSizeButton)
            toolbar.appendChild(fontSizeDisplay)
            toolbar.appendChild(increaseSizeButton)

            document.addEventListener('selectionchange', handleSelectionChange)
            textBlock.addEventListener('mouseup', handleSelectionChange)
            textBlock.addEventListener('keyup', handleSelectionChange)

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

            const getCaretClientRect = () => {
                const selection = window.getSelection()
                if (!selection || selection.rangeCount === 0) return null

                const range = selection.getRangeAt(0).cloneRange()
                range.collapse(true)

                // Try native rect first
                let rect = range.getBoundingClientRect()
                if (rect && (rect.width !== 0 || rect.height !== 0)) {
                    return rect
                }

                // Fallback: insert a marker to measure exact caret position
                const marker = document.createElement("span")
                marker.textContent = "\u200b"
                marker.style.display = "inline-block"
                marker.style.width = "0"
                marker.style.overflow = "hidden"
                marker.style.lineHeight = "1"

                range.insertNode(marker)

                rect = marker.getBoundingClientRect()

                // Restore caret after marker
                const newRange = document.createRange()
                newRange.setStartAfter(marker)
                newRange.collapse(true)

                marker.parentNode?.removeChild(marker)

                selection.removeAllRanges()
                selection.addRange(newRange)

                return rect
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
                const rect = getCaretClientRect()
                if (rect) {
                    dropdown.style.left = `${Math.round(rect.left)}px`
                    dropdown.style.top = `${Math.round(rect.bottom + 5)}px`
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

                if (!dropdownKeyListenerAttached) {
                    document.addEventListener('keydown', handleDropdownKeydown, true)
                    dropdownKeyListenerAttached = true
                }
            }

            const hideDropdown = () => {
                if (dropdown && document.body.contains(dropdown)) {
                    document.body.removeChild(dropdown)
                    dropdown = null
                    dropdownItems = []
                    selectableFieldEntries = []
                    selectedIndex = -1
                }

                if (dropdownKeyListenerAttached) {
                    document.removeEventListener('keydown', handleDropdownKeydown, true)
                    dropdownKeyListenerAttached = false
                }
            }

            const handleDropdownKeydown = (e: KeyboardEvent) => {
                if (!dropdown || dropdownItems.length === 0) return
                if (e.key !== 'Enter' && e.key !== 'Tab') return

                e.preventDefault()
                e.stopPropagation()

                const index = selectedIndex >= 0 ? selectedIndex : 0
                updateSelectedItem(index)

                const selectedField = selectableFieldEntries[index]?.field
                if (selectedField) {
                    insertVariable(selectedField)
                }
            }

            const insertVariable = (fieldName: string) => {
                const selection = window.getSelection()
                if (!selection || !selection.rangeCount) return

                // Remove a preceding "{{" if the caret is right after it to avoid duplicating braces
                const initialRange = selection.getRangeAt(0)
                if (initialRange.collapsed) {
                    const caretOffset = getCaretOffset(textBlock)
                    if (caretOffset >= 2 && textBlock.innerText.slice(caretOffset - 2, caretOffset) === "{{") {
                        const startPos = findTextPosition(textBlock, caretOffset - 2)
                        const endPos = findTextPosition(textBlock, caretOffset)
                        const removeRange = document.createRange()
                        removeRange.setStart(startPos.node, startPos.offset)
                        removeRange.setEnd(endPos.node, endPos.offset)
                        removeRange.deleteContents()

                        selection.removeAllRanges()
                        selection.addRange(removeRange)
                    }
                }

                const variableNode = document.createTextNode(`{{${fieldName}}}`)

                const range = selection.getRangeAt(0)
                range.deleteContents()
                range.insertNode(variableNode)

                // Move caret to the end of the inserted variable
                range.setStartAfter(variableNode)
                range.collapse(true)
                selection.removeAllRanges()
                selection.addRange(range)

                commitContentChange()
                hideDropdown()
                textBlock.focus()
            }

            // Get only the text on the current line (from last newline to cursor)
            // Supports all line ending formats: \n, \r\n, \r
            const getCurrentLineText = (text: string, cursorPos: number): string => {
                // Find the last line break before cursor (supports \n, \r\n, \r)
                let lastNewlinePos = -1
                for (let i = cursorPos - 1; i >= 0; i--) {
                    if (text[i] === '\n' || text[i] === '\r') {
                        lastNewlinePos = i
                        break
                    }
                }
                const lineStartPos = lastNewlinePos === -1 ? 0 : lastNewlinePos + 1
                return text.substring(lineStartPos, cursorPos)
            }

            textBlock.addEventListener('input', () => {
                const currentText = textBlock.textContent || ''
                const selection = window.getSelection()
                if (!selection || !selection.rangeCount) return
                
                const cursorPos = getCaretOffset(textBlock)  // Use the correct function
                const currentLineText = getCurrentLineText(currentText, cursorPos)
                
                // Check if current line ends with "{{" (just typed it)
                if (currentLineText.endsWith("{{") && !lastText.endsWith("{{")) {
                    showDropdown("")
                } else if (currentLineText.includes("{{") && !currentLineText.substring(currentLineText.lastIndexOf("{{")).includes("}}")) {
                    // User is typing inside {{ }} on the current line only
                    const startIdx = currentLineText.lastIndexOf("{{")
                    const filterText = currentLineText.substring(startIdx + 2)
                    showDropdown(filterText)
                } else {
                    hideDropdown()
                }
                
                lastText = currentText
                handleSelectionChange()
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
                            // Handled globally when dropdown open
                            e.preventDefault()
                            e.stopPropagation()
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
