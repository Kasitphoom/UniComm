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
    bold?: Array<{ start: number; end: number }>
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

// Render text with bold ranges as HTML spans
const renderBoldRanges = (text: string, boldRanges: Array<{ start: number; end: number }>): string => {
    if (!boldRanges || boldRanges.length === 0) {
        return text
    }

    const sortedRanges = [...boldRanges].sort((a, b) => a.start - b.start)
    let result = ''
    let lastEnd = 0

    console.log(sortedRanges)

    for (const range of sortedRanges) {
        // Add text before this bold range
        if (lastEnd < range.start) {
            result += text.slice(lastEnd, range.start)
        }
        
        // Add bold text
        const boldText = text.slice(range.start, range.end + 1)
        result += `<span style="font-weight: 700">${boldText}</span>`
        
        lastEnd = range.end + 1
    }
    
    // Add remaining text after the last bold range
    if (lastEnd < text.length) {
        result += text.slice(lastEnd)
    }
    
    return result
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
        let displayHtml = isEditableMode
            ? initialHtml
            : (schema.content ? applyVariablesToHtml(schema.content, valueData) : parseVariables(rawText, valueData))

        // Apply bold ranges if they exist in the schema
        if (isEditableMode && schema.bold && schema.bold.length > 0) {
            const plainText = stripHtmlTags(displayHtml)
            displayHtml = renderBoldRanges(plainText, schema.bold)
        }

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

        let activeBoldRanges = Array.isArray(schema.bold)
            ? schema.bold.map((range) => ({ ...range }))
            : []

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

        const setSelectionOffsets = (element: HTMLDivElement, startOffset: number, endOffsetExclusive: number) => {
            const selection = window.getSelection()
            if (!selection) return

            const safeStart = Math.max(0, startOffset)
            const safeEnd = Math.max(safeStart, endOffsetExclusive)

            const startPos = findTextPosition(element, safeStart)
            const endPos = findTextPosition(element, safeEnd)

            const range = document.createRange()
            range.setStart(startPos.node, startPos.offset)
            range.setEnd(endPos.node, endPos.offset)

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
        let hideToolbar = () => {}

        const commitContentChange = () => {
            const plainText = getText(textBlock)
            const newVariables = extractVariables(plainText)

            if (onChange) {
                onChange([
                    { key: 'content', value: textBlock.innerHTML },
                    { key: 'text', value: plainText },
                    { key: 'variables', value: newVariables },
                    { key: 'bold', value: schema.bold || [] }, // Keep existing bold ranges
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
                if (!selection || selection.rangeCount === 0) return false
                
                const range = selection.getRangeAt(0)
                if (range.collapsed) {
                    // For collapsed selection (caret), check if cursor is in a bold range
                    const caretPos = getCaretOffset(textBlock)
                    const boldRanges = activeBoldRanges
                    
                    for (const boldRange of boldRanges) {
                        if (caretPos >= boldRange.start && caretPos <= boldRange.end) {
                            return true
                        }
                    }
                    return false
                }
                
                // For range selection, check if entire selection is bold based on schema
                const textRange = getTextRangeFromSelection()
                if (!textRange) return false
                
                const boldRanges = activeBoldRanges
                const isRangeBoldInSchema = isRangeBold(textRange.start, textRange.end, boldRanges)
                
                console.log('[TextWithVariables] isSelectionBold check:', {
                    textRange,
                    boldRanges,
                    isRangeBoldInSchema
                })
                
                // Use advanced bold detection
                const entirelyBold = isEntirelyBold(textRange.start, textRange.end, boldRanges)
                const partialOverlap = hasPartialOverlap(textRange.start, textRange.end, boldRanges)
                
                console.log('[TextWithVariables] Advanced bold detection:', {
                    entirelyBold,
                    partialOverlap,
                    isRangeBoldInSchema
                })
                
                // If entirely bold, return true
                if (entirelyBold) {
                    return true
                }
                
                // If partial overlap, consider it "mixed" state - we'll treat as not bold for toggle
                if (partialOverlap) {
                    return false
                }

                return false
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

            // Bold range utility functions
            const mergeBoldRanges = (ranges: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> => {
                if (ranges.length === 0) return []
                
                const sorted = [...ranges].sort((a, b) => a.start - b.start)
                const merged = [sorted[0]]
                
                for (let i = 1; i < sorted.length; i++) {
                    const current = sorted[i]
                    const last = merged[merged.length - 1]
                    
                    if (current.start <= last.end + 1) {
                        // Overlapping or adjacent inclusive ranges - merge them
                        last.end = Math.max(last.end, current.end)
                    } else {
                        // Non-overlapping range - add it
                        merged.push(current)
                    }
                }
                
                return merged
            }

            const isRangeBold = (start: number, end: number, boldRanges: Array<{ start: number; end: number }>): boolean => {
                for (const range of boldRanges) {
                    if (range.start <= start && range.end >= end) {
                        return true
                    }
                }
                return false
            }

            const isEntirelyBold = (start: number, end: number, boldRanges: Array<{ start: number; end: number }>): boolean => {
                // Check if the entire inclusive selection is covered by bold ranges.
                let currentPos = start
                const sortedRanges = [...boldRanges].sort((a, b) => a.start - b.start)
                
                for (const range of sortedRanges) {
                    if (range.start <= currentPos && range.end >= currentPos) {
                        currentPos = range.end + 1
                        if (currentPos > end) {
                            return true
                        }
                    }
                }
                
                return false
            }

            const hasPartialOverlap = (start: number, end: number, boldRanges: Array<{ start: number; end: number }>): boolean => {
                for (const range of boldRanges) {
                    if (range.start <= end && range.end >= start) {
                        return !(range.start <= start && range.end >= end)
                    }
                }
                return false
            }

            const getOverlappingRanges = (start: number, end: number, boldRanges: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> => {
                return boldRanges.filter(range => range.start <= end && range.end >= start)
            }

            const addBoldRange = (start: number, end: number, currentRanges: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> => {
                const newRanges = [...currentRanges, { start, end }]
                return mergeBoldRanges(newRanges)
            }

            const removeBoldRange = (start: number, end: number, currentRanges: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> => {
                const result: Array<{ start: number; end: number }> = []
                
                for (const range of currentRanges) {
                    if (range.end < start || range.start > end) {
                        // No overlap - keep the range
                        result.push(range)
                    } else {
                        // There is overlap - split if needed
                        if (range.start < start) {
                            // Keep the part before the removed range
                            result.push({ start: range.start, end: start - 1 })
                        }
                        if (range.end > end) {
                            // Keep the part after the removed range
                            result.push({ start: end + 1, end: range.end })
                        }
                    }
                }
                
                return result
            }

            const extendBoldRangeToInclude = (start: number, end: number, currentRanges: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> => {
                // Remove overlapping ranges and create a new range that includes the selection
                const nonOverlapping = currentRanges.filter(range => !(range.start <= end && range.end >= start))
                const overlapping = getOverlappingRanges(start, end, currentRanges)
                
                // Find the extended bounds
                let extendedStart = start
                let extendedEnd = end
                
                for (const range of overlapping) {
                    extendedStart = Math.min(extendedStart, range.start)
                    extendedEnd = Math.max(extendedEnd, range.end)
                }
                
                // Add the extended range
                const newRanges = [...nonOverlapping, { start: extendedStart, end: extendedEnd }]
                return mergeBoldRanges(newRanges)
            }

            const getTextRangeFromSelection = (): { start: number; end: number } | null => {
                const selection = window.getSelection()
                if (!selection || selection.rangeCount === 0) return null
                
                const range = selection.getRangeAt(0)
                if (range.collapsed) return null

                // Get the full text content and find position by walking through text nodes
                const fullText = textBlock.innerText || textBlock.textContent || ''
                
                // Find start position
                let startPos = 0
                const startContainer = range.startContainer
                const walker = document.createTreeWalker(
                    textBlock,
                    NodeFilter.SHOW_TEXT,
                    null
                )
                
                let node = walker.nextNode()
                while (node && node !== startContainer) {
                    startPos += node.textContent?.length || 0
                    node = walker.nextNode()
                }
                startPos += range.startOffset

                // Find end position  
                let endPos = 0
                const endContainer = range.endContainer
                const endWalker = document.createTreeWalker(
                    textBlock,
                    NodeFilter.SHOW_TEXT,
                    null
                )
                
                let endNode = endWalker.nextNode()
                while (endNode && endNode !== endContainer) {
                    endPos += endNode.textContent?.length || 0
                    endNode = endWalker.nextNode()
                }
                endPos += range.endOffset

                const normalizedStart = Math.min(startPos, endPos)
                const normalizedEnd = Math.max(startPos, endPos) - 1
                if (normalizedEnd < normalizedStart) return null

                return { start: normalizedStart, end: normalizedEnd }
            }

            const getSpansInSelection = (): HTMLSpanElement[] => {
                const selection = window.getSelection()
                if (!selection || selection.rangeCount === 0) return []

                const range = selection.getRangeAt(0)
                if (range.collapsed) return []

                const spans = new Set<HTMLSpanElement>()
                const container = range.commonAncestorContainer
                const root = container instanceof Element ? container : container.parentElement
                if (!root) return []

                if (root instanceof HTMLSpanElement && range.intersectsNode(root)) {
                    spans.add(root)
                }

                root.querySelectorAll('span').forEach((node) => {
                    if (node instanceof HTMLSpanElement && range.intersectsNode(node)) {
                        spans.add(node)
                    }
                })

                return Array.from(spans)
            }

            const logSpansInSelection = () => {
                const spans = getSpansInSelection()
                const selection = window.getSelection()
                
                console.log('=== BOLD TOGGLE DEBUG ===')
                
                if (spans.length === 0) {
                    console.log('[TextWithVariables] No span elements in current selection')
                } else {
                    console.log(
                        '[TextWithVariables] Span elements in current selection:',
                        spans.map((span) => ({
                            text: span.textContent,
                            style: span.getAttribute('style') || '',
                            html: span.outerHTML,
                        })),
                    )
                }

                // Log current bold ranges from schema
                console.log('[TextWithVariables] Bold ranges in schema:', schema.bold || [])
                console.log('[TextWithVariables] Active bold ranges:', activeBoldRanges)
                
                // Log selection details
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0)
                    const textRange = getTextRangeFromSelection()
                    console.log('[TextWithVariables] Selection text range:', textRange)
                    console.log('[TextWithVariables] Selected text:', range.toString())
                }
                
                // Check spans around selection
                const spanContext = checkSpansAroundSelection()
                console.log('[TextWithVariables] Context spans around selection:', spanContext)
                
                console.log('=========================')
            }

            const checkSpansAroundSelection = (): { left: HTMLSpanElement | null, right: HTMLSpanElement | null, hasContext: boolean } => {
                const selection = window.getSelection()
                if (!selection || selection.rangeCount === 0) return { left: null, right: null, hasContext: false }
                
                const range = selection.getRangeAt(0)
                const textRange = getTextRangeFromSelection()
                if (!textRange) return { left: null, right: null, hasContext: false }

                // Check for span immediately before selection
                let leftSpan: HTMLSpanElement | null = null
                if (textRange.start > 0) {
                    // Create a range just before the selection
                    const beforeRange = document.createRange()
                    const startPos = Math.max(0, textRange.start - 1)
                    
                    try {
                        const beforePosition = findTextPosition(textBlock, startPos)
                        beforeRange.setStart(beforePosition.node, beforePosition.offset)
                        beforeRange.setEnd(beforePosition.node, beforePosition.offset + 1)
                        
                        const beforeContainer = beforeRange.commonAncestorContainer
                        const beforeElement = beforeContainer instanceof Element ? beforeContainer : beforeContainer.parentElement
                        if (beforeElement instanceof HTMLSpanElement) {
                            leftSpan = beforeElement
                        }
                    } catch (e) {
                        // Ignore range errors
                    }
                }

                // Check for span immediately after selection  
                let rightSpan: HTMLSpanElement | null = null
                const fullText = textBlock.innerText || ''
                if (textRange.end < fullText.length - 1) {
                    try {
                        const afterPosition = findTextPosition(textBlock, textRange.end + 1)
                        const afterRange = document.createRange()
                        afterRange.setStart(afterPosition.node, afterPosition.offset)
                        afterRange.setEnd(afterPosition.node, afterPosition.offset + 1)
                        
                        const afterContainer = afterRange.commonAncestorContainer
                        const afterElement = afterContainer instanceof Element ? afterContainer : afterContainer.parentElement
                        if (afterElement instanceof HTMLSpanElement) {
                            rightSpan = afterElement
                        }
                    } catch (e) {
                        // Ignore range errors
                    }
                }

                const hasContext = leftSpan !== null || rightSpan !== null
                return { left: leftSpan, right: rightSpan, hasContext }
            }

            const renderContentWithBold = (boldRanges?: Array<{ start: number; end: number }>) => {
                const plainText = getText(textBlock)
                const ranges = boldRanges || activeBoldRanges
                
                console.log('[TextWithVariables] renderContentWithBold:', {
                    plainText,
                    ranges,
                    schemaRanges: schema.bold,
                    activeBoldRanges,
                })
                
                // Clear existing content and render with bold ranges
                const renderedHtml = renderBoldRanges(plainText, ranges)
                textBlock.innerHTML = renderedHtml
                
                console.log('[TextWithVariables] After render, innerHTML:', textBlock.innerHTML)
            }

            const toggleBold = () => {
                const selection = window.getSelection()
                if (!selection || selection.rangeCount === 0) return
                const range = selection.getRangeAt(0)
                if (range.collapsed) return

                // Get the text range that is selected
                const textRange = getTextRangeFromSelection()
                if (!textRange) return

                // Get current state and context
                const spansInSelection = getSpansInSelection()
                const context = checkSpansAroundSelection()
                const currentBoldRanges = activeBoldRanges
                
                console.log('[TextWithVariables] toggleBold state:', {
                    textRange,
                    spansInSelection: spansInSelection.length,
                    context,
                    currentBoldRanges
                })

                let newBoldRanges: Array<{ start: number; end: number }>
                let shouldMakeBold = false

                // Advanced bold toggle logic
                const entirelyBold = isEntirelyBold(textRange.start, textRange.end, currentBoldRanges)
                const overlappingRanges = getOverlappingRanges(textRange.start, textRange.end, currentBoldRanges)
                
                console.log('[TextWithVariables] Advanced bold analysis:', {
                    entirelyBold,
                    overlappingRanges: overlappingRanges.length
                })

                if (entirelyBold) {
                    // Case 1: Selection is entirely bold - remove only this part.
                    console.log('[TextWithVariables] Selection entirely bold - removing bold (may split ranges)')
                    newBoldRanges = removeBoldRange(textRange.start, textRange.end, currentBoldRanges)
                    shouldMakeBold = false
                } else if (overlappingRanges.length > 0) {
                    // Case 2: Any overlap exists - extend to make entire selection bold.
                    console.log('[TextWithVariables] Overlap detected - extending to make entire selection bold')
                    newBoldRanges = extendBoldRangeToInclude(textRange.start, textRange.end, currentBoldRanges)
                    shouldMakeBold = true
                } else {
                    // Case 3: No overlap - make bold
                    console.log('[TextWithVariables] No overlap - making selection bold')
                    newBoldRanges = addBoldRange(textRange.start, textRange.end, currentBoldRanges)
                    shouldMakeBold = true
                }

                console.log('[TextWithVariables] toggleBold result:', {
                    shouldMakeBold,
                    oldRanges: currentBoldRanges,
                    newRanges: newBoldRanges
                })

                activeBoldRanges = newBoldRanges.map((range) => ({ ...range }))

                // Re-render the content with new bold ranges FIRST
                renderContentWithBold(activeBoldRanges)

                // Update the schema with new bold ranges
                if (onChange) {
                    onChange({ key: 'bold', value: activeBoldRanges })
                }

                // Restore selection
                setTimeout(() => {
                    setSelectionOffsets(textBlock, textRange.start, textRange.end + 1)
                }, 0)

                updateToolbarPosition()
            }

            hideToolbar = () => {
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
            boldButton.onmousedown = (e) => {
                e.preventDefault() // Prevent losing focus
                textBlock.focus() // Ensure textBlock has focus
            }
            boldButton.onclick = (e) => {
                e.preventDefault()
                console.log('[TextWithVariables] Bold button clicked')
                
                // Ensure we have focus and selection
                textBlock.focus()
                
                // Small delay to ensure selection is properly established
                setTimeout(() => {
                    logSpansInSelection()
                    toggleBold()
                }, 10)
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
