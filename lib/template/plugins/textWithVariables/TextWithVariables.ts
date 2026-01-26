import type { PDFRenderProps, Plugin, Schema, getDefaultFont } from "@pdfme/common"
import { createSvgStr } from "@pdfme/schemas/utils"
import { text as textPlugin } from "@pdfme/schemas"
import { Type } from "lucide"
import type { UIRenderProps } from "@pdfme/common"
import { TextWithVariablesPropPanel } from "./propPanel"
import { TemplateWithUser } from "@/types/template"

export type TextWithVariablesSchema = Schema & {
    fontSize?: number
    fontColor?: string
    alignment?: "left" | "center" | "right"
    fontName?: string
    text?: string
    variables?: string[]
}

// Get template ID from current URL
const getTemplateIdFromUrl = (): string | null => {
    if (typeof window === 'undefined') return null
    const pathname = window.location.pathname
    const match = pathname.match(/\/templates\/([^/]+)/)
    return match ? match[1] : null
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
    return Array.from(matches, m => m[1].trim())
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

// Render form mode with individual input fields for each variable
const renderFormMode = async (
    arg: UIRenderProps<TextWithVariablesSchema>,
    rawText: string,
    variables: string[]
) => {
    const { rootElement, schema, onChange, stopEditing, theme, value } = arg

    // Parse existing values
    let valueData: Record<string, string> = {}
    if (typeof value === 'string' && value) {
        try {
            valueData = JSON.parse(value)
        } catch {
            valueData = {}
        }
    } else if (typeof value === 'object' && value !== null) {
        valueData = value as Record<string, string>
    }

    // Remove outline from parent (we'll apply to individual fields)
    if (rootElement.parentElement) {
        rootElement.parentElement.style.outline = ''
    }

    rootElement.innerHTML = ''

    // Create container matching the text styling
    const container = document.createElement("div")
    container.style.width = "100%"
    container.style.height = "100%"
    container.style.display = "block"
    container.style.padding = "0"
    container.style.boxSizing = "border-box"
    container.style.border = "none"
    container.style.background = "#FF0000"
    rootElement.appendChild(container)

    const textBlock = document.createElement("div")
    textBlock.style.width = "100%"
    textBlock.style.fontFamily = schema.fontName || "sans-serif"
    textBlock.style.fontSize = `${schema.fontSize || 12}pt`
    textBlock.style.color = schema.fontColor || "#000000"
    textBlock.style.textAlign = schema.alignment || "left"
    textBlock.style.whiteSpace = "pre-wrap"
    textBlock.style.wordBreak = "break-word"
    textBlock.style.outline = "none"
    textBlock.style.border = "none"
    textBlock.style.margin = "0"
    textBlock.style.padding = "0"
    container.appendChild(textBlock)

    // Track which characters are part of variables
    const variableIndices: { [index: number]: string } = {}
    variables.forEach(varName => {
        const regex = new RegExp(`\\{\\{\\s*${varName.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*\\}\\}`, 'g')
        let match
        while ((match = regex.exec(rawText)) !== null) {
            variableIndices[match.index] = varName
        }
    })

    // Build the text with inline input fields
    let inVariable = false
    let currentVarName = ''

    for (let i = 0; i < rawText.length; i++) {
        if (variableIndices[i]) {
            // Start of a variable
            inVariable = true
            currentVarName = variableIndices[i]

            const input = document.createElement('span')
            input.contentEditable = 'true'
            input.style.outline = `${theme?.colorPrimary || '#1890ff'} dashed 1px`
            input.style.padding = '2px 4px'
            input.style.minWidth = '40px'
            input.style.display = 'inline-block'
            input.style.borderRadius = '2px'
            input.textContent = valueData[currentVarName] || ''
            
            input.addEventListener('blur', (e: Event) => {
                const newValue = (e.target as HTMLSpanElement).textContent || ''
                if (newValue !== valueData[currentVarName]) {
                    valueData[currentVarName] = newValue
                    if (onChange) {
                        onChange({ key: 'content', value: JSON.stringify(valueData) })
                    }
                    if (stopEditing) stopEditing()
                }
            })

            input.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                    e.preventDefault()
                    input.blur()
                }
            })

            textBlock.appendChild(input)

            // Skip the rest of the variable pattern {{varName}}
            const varPattern = `{{${currentVarName}}}`
            i += varPattern.length - 1
        } else if (inVariable) {
            // Check if we've exited the variable
            if (rawText[i] === '}' && rawText[i - 1] === '}') {
                inVariable = false
                currentVarName = ''
            }
        } else {
            // Regular text character
            const span = document.createElement('span')
            span.textContent = rawText[i]
            textBlock.appendChild(span)
        }
    }
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
        if (mode === 'designer' && JSON.stringify(variables) !== JSON.stringify(schema.variables)) {
            if (onChange) {
                onChange({ key: 'variables', value: variables })
            }
        }

        // Form mode - render individual input fields for each variable
        if (mode === 'form' && variables.length > 0) {
            await renderFormMode(arg, rawText, variables)
            return
        }

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

        // In viewer mode, show processed text with variables replaced
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
        container.style.justifyContent = "flex-start"
        container.style.padding = "0"
        container.style.boxSizing = "border-box"
        container.style.cursor = isEditableMode ? "text" : "default"
        container.style.border = "none"
        rootElement.appendChild(container)

        // Create text element
        const textBlock = document.createElement("div")
        textBlock.id = `text-${schema.id}`
        textBlock.style.width = "100%"
        textBlock.style.fontFamily = schema.fontName || "sans-serif"
        textBlock.style.fontSize = `${schema.fontSize || 12}pt`
        textBlock.style.color = schema.fontColor || "#000000"
        textBlock.style.textAlign = schema.alignment || "left"
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
            let fields: Array<{ field: string; type: string }> = []
            let selectedIndex = -1
            let dropdownItems: HTMLDivElement[] = []

            // Fetch template settings and contact list fields
            const fetchFields = async () => {
                try {
                    const templateId = getTemplateIdFromUrl()
                    if (!templateId) {
                        console.warn("Could not extract template ID from URL")
                        return
                    }

                    const response = await fetch(`/api/templates/${templateId}`)
                    if (!response.ok) {
                        console.error("Failed to fetch template settings:", response.statusText)
                        return
                    }

                    const data = (await response.json()) as TemplateWithUser
                    fields = (data.contactList?.fields as Array<{ field: string; type: string }>) || []
                } catch (err) {
                    console.error("Failed to fetch template settings:", err)
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

                const filteredFields = fields.filter(f => 
                    f.field.toLowerCase().includes(filterText.toLowerCase())
                )

                dropdownItems = []
                selectedIndex = -1

                if (filteredFields.length === 0) {
                    const emptyMsg = document.createElement("div")
                    emptyMsg.textContent = "No fields available"
                    emptyMsg.style.padding = "8px 12px"
                    emptyMsg.style.fontSize = "12px"
                    emptyMsg.style.color = "#999"
                    dropdown.appendChild(emptyMsg)
                } else {
                    filteredFields.forEach((field, index) => {
                        const item = document.createElement("div")
                        item.textContent = field.field
                        item.style.padding = "8px 12px"
                        item.style.cursor = "pointer"
                        item.style.fontSize = "12px"
                        item.style.borderBottom = "1px solid #f0f0f0"
                        item.style.transition = "background-color 0.15s"

                        item.onmouseenter = () => { 
                            selectedIndex = index
                            updateSelectedItem(index)
                        }
                        item.onmouseleave = () => { 
                            item.style.backgroundColor = selectedIndex === index ? "#e6f7ff" : "transparent"
                        }
                        item.onmousedown = (e) => {
                            e.preventDefault()
                            insertVariable(field.field)
                        }

                        dropdownItems.push(item)
                        dropdown?.appendChild(item)
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
                    selectedIndex = -1
                }
            }

            const insertVariable = (fieldName: string) => {
                const selection = window.getSelection()
                if (!selection || !selection.rangeCount) return

                const range = selection.getRangeAt(0)
                const textContent = textBlock.textContent || ''
                const cursorPos = range.startOffset

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
                const newRange = document.createRange()
                const textNode = textBlock.firstChild
                if (textNode) {
                    newRange.setStart(textNode, Math.min(newCursorPos, textNode.textContent?.length || 0))
                    newRange.collapse(true)
                    selection.removeAllRanges()
                    selection.addRange(newRange)
                }
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
                                const selectedField = dropdownItems[selectedIndex].textContent
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
