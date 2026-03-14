import type { PDFRenderProps, Plugin, Schema, Font } from "@pdfme/common"
import { getDefaultFont, getFallbackFontName, mm2pt } from "@pdfme/common"
import type { PDFFont } from "@pdfme/pdf-lib"
import { createSvgStr } from "@pdfme/schemas/utils"
import { text as textPlugin } from "@pdfme/schemas"
import { Type } from "lucide"
import type { UIRenderProps } from "@pdfme/common"
import { TextWithVariablesPropPanel } from "./propPanel"
import {
    getFontSizeAtIndex,
    isIndexInStyleRanges,
    isIndexBold,
    normalizeBoldRanges,
    normalizeFontSizeRanges,
    normalizeStyleRanges,
    projectBoldRangesBySourceMap,
    projectFontSizeRangesBySourceMap,
    projectStyleRangesBySourceMap,
    renderStyledRanges,
    setFontSizeRange,
    type BoldRange,
    type FontSizeRange,
    type StyleRange,
    toggleStyleRanges,
} from "./textStyleRanges"

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
    fontSizeRanges?: Array<{ start: number; end: number; size: number }>
    italicRanges?: Array<{ start: number; end: number }>
    underlineRanges?: Array<{ start: number; end: number }>
    strikeRanges?: Array<{ start: number; end: number }>
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

const getFontVariantName = (
    fontName: string | undefined,
    font: Font,
    bold: boolean,
    italic: boolean,
): string => {
    const fallback = getFallbackFontName(font)
    const current = fontName || fallback
    const names = Object.keys(font)

    const family = current
        .replace(/-BoldItalic|-Bold|-Italic|-Regular/gi, '')
        .trim()

    const candidates = bold && italic
        ? [
            `${family}-BoldItalic`,
            `${family} Bold Italic`,
            `${family}-ItalicBold`,
            `${family} Italic Bold`,
            `${family}-Bold`,
            `${family}-Italic`,
        ]
        : bold
            ? [`${family}-Bold`, `${family} Bold`, `${family}-BoldItalic`]
            : italic
                ? [`${family}-Italic`, `${family} Italic`, `${family}-Oblique`, `${family} Oblique`]
                : [current, `${family}-Regular`, `${family} Regular`]

    for (const candidate of candidates) {
        if (font[candidate]) return candidate
    }

    const fuzzy = names.find((name) => {
        const lower = name.toLowerCase()
        if (!lower.includes(family.toLowerCase())) return false
        if (bold && !lower.includes('bold')) return false
        if (italic && !(lower.includes('italic') || lower.includes('oblique'))) return false
        return true
    })

    return fuzzy || current
}

const toUint8Array = async (fontData: unknown): Promise<Uint8Array<ArrayBuffer>> => {
    if (fontData instanceof Uint8Array) {
        return fontData as Uint8Array<ArrayBuffer>
    }
    if (fontData instanceof ArrayBuffer) {
        return new Uint8Array(fontData) as Uint8Array<ArrayBuffer>
    }
    if (typeof fontData === 'string') {
        if (fontData.startsWith('http')) {
            const buffer = await fetch(fontData).then((res) => res.arrayBuffer())
            return new Uint8Array(buffer) as Uint8Array<ArrayBuffer>
        }
        try {
            const base64 = fontData.includes(',') ? fontData.split(',')[1] : fontData
            const binary = atob(base64)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
            return bytes as Uint8Array<ArrayBuffer>
        } catch {
            return new Uint8Array() as Uint8Array<ArrayBuffer>
        }
    }
    return new Uint8Array() as Uint8Array<ArrayBuffer>
}

const hexToPdfColor = (hex: string | undefined, pdfLib: PDFRenderProps<TextWithVariablesSchema>["pdfLib"]) => {
    const value = (hex || '#000000').replace('#', '')
    const normalized = value.length === 3
        ? value.split('').map((c) => c + c).join('')
        : value
    const r = parseInt(normalized.slice(0, 2), 16)
    const g = parseInt(normalized.slice(2, 4), 16)
    const b = parseInt(normalized.slice(4, 6), 16)
    return pdfLib.rgb((Number.isNaN(r) ? 0 : r) / 255, (Number.isNaN(g) ? 0 : g) / 255, (Number.isNaN(b) ? 0 : b) / 255)
}

const splitLinesForMixedText = (
    text: string,
    maxWidth: number,
    baseFontSize: number,
    charSpacing: number,
    getFontForStyle: (isBold: boolean, isItalic: boolean) => PDFFont,
    boldRanges: BoldRange[],
    fontSizeRanges: FontSizeRange[],
    italicRanges: StyleRange[],
    underlineRanges: StyleRange[],
    strikeRanges: StyleRange[],
) => {
    type CharEntry = {
        char: string
        index: number
        bold: boolean
        italic: boolean
        underline: boolean
        strike: boolean
        fontSize: number
        width: number
    }
    type Line = CharEntry[]

    const lines: Line[] = []
    let currentLine: Line = []
    let currentLineWidth = 0

    const chars = Array.from(text)

    const pushCurrentLine = () => {
        lines.push(currentLine)
        currentLine = []
        currentLineWidth = 0
    }

    for (let index = 0; index < chars.length; index++) {
        const char = chars[index]

        if (char === '\n' || char === '\r') {
            pushCurrentLine()
            continue
        }

        const isBold = isIndexBold(index, boldRanges)
        const isItalic = isIndexInStyleRanges(index, italicRanges)
        const isUnderline = isIndexInStyleRanges(index, underlineRanges)
        const isStrike = isIndexInStyleRanges(index, strikeRanges)
        const charFontSize = getFontSizeAtIndex(index, fontSizeRanges, baseFontSize)
        const font = getFontForStyle(isBold, isItalic)
        const charWidth = font.widthOfTextAtSize(char, charFontSize)
        const additionalSpacing = currentLine.length > 0 ? charSpacing : 0
        const nextWidth = currentLineWidth + charWidth + additionalSpacing

        if (currentLine.length > 0 && nextWidth > maxWidth) {
            pushCurrentLine()
        }

        const entry: CharEntry = {
            char,
            index,
            bold: isBold,
            italic: isItalic,
            underline: isUnderline,
            strike: isStrike,
            fontSize: charFontSize,
            width: charWidth,
        }

        currentLine.push(entry)
        currentLineWidth += entry.width + (currentLine.length > 1 ? charSpacing : 0)
    }

    if (currentLine.length > 0 || lines.length === 0) {
        lines.push(currentLine)
    }

    return lines
};

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
const parseVariablesWithMapping = (text: string, data?: Record<string, any>): { text: string; sourceIndexByOutputIndex: number[] } => {
    if (typeof text !== "string") {
        return { text: '', sourceIndexByOutputIndex: [] }
    }

    const regex = /\{\{([^{}]+)\}\}/g
    let outputText = ''
    const sourceIndexByOutputIndex: number[] = []
    let sourceCursor = 0

    let match: RegExpExecArray | null = null
    while ((match = regex.exec(text)) !== null) {
        const matchStart = match.index
        const matchFull = match[0]
        const matchEnd = matchStart + matchFull.length

        if (sourceCursor < matchStart) {
            const plainChunk = text.slice(sourceCursor, matchStart)
            outputText += plainChunk
            for (let offset = 0; offset < plainChunk.length; offset++) {
                sourceIndexByOutputIndex.push(sourceCursor + offset)
            }
        }

        const rawFieldName = match[1]
        const trimmedFieldName = rawFieldName.trim()
        const replacement = data && Object.prototype.hasOwnProperty.call(data, trimmedFieldName)
            ? String(data[trimmedFieldName])
            : trimmedFieldName

        const leftTrim = rawFieldName.length - rawFieldName.trimStart().length
        const sourceAnchorStart = Math.min(matchEnd - 1, matchStart + 2 + leftTrim)

        outputText += replacement
        for (let offset = 0; offset < replacement.length; offset++) {
            sourceIndexByOutputIndex.push(sourceAnchorStart + offset)
        }

        sourceCursor = matchEnd
    }

    if (sourceCursor < text.length) {
        const tailChunk = text.slice(sourceCursor)
        outputText += tailChunk
        for (let offset = 0; offset < tailChunk.length; offset++) {
            sourceIndexByOutputIndex.push(sourceCursor + offset)
        }
    }

    return { text: outputText, sourceIndexByOutputIndex }
}

const parseVariables = (text: string, data?: Record<string, any>): string => {
    return parseVariablesWithMapping(text, data).text
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
        const parsedText = parseVariablesWithMapping(rawText, valueData)
        const processedText = parsedText.text
        const sourceBoldRanges = normalizeBoldRanges(schema.bold)
        const baseFontSize = schema.fontSize || 12
        const sourceFontSizeRanges = normalizeFontSizeRanges(schema.fontSizeRanges)
        const sourceItalicRanges = normalizeStyleRanges(schema.italicRanges)
        const sourceUnderlineRanges = normalizeStyleRanges(schema.underlineRanges)
        const sourceStrikeRanges = normalizeStyleRanges(schema.strikeRanges)
        const boldRanges = projectBoldRangesBySourceMap(sourceBoldRanges, parsedText.sourceIndexByOutputIndex)
        const fontSizeRanges = projectFontSizeRangesBySourceMap(
            sourceFontSizeRanges,
            parsedText.sourceIndexByOutputIndex,
            baseFontSize,
        )
        const italicRanges = projectStyleRangesBySourceMap(sourceItalicRanges, parsedText.sourceIndexByOutputIndex)
        const underlineRanges = projectStyleRangesBySourceMap(sourceUnderlineRanges, parsedText.sourceIndexByOutputIndex)
        const strikeRanges = projectStyleRangesBySourceMap(sourceStrikeRanges, parsedText.sourceIndexByOutputIndex)

        const { pdfDoc, page, options, pdfLib } = rest
        const fontMap = options.font || getDefaultFont()
        const baseFontName = schema.fontName || getFallbackFontName(fontMap)
        const boldFontName = getFontVariantName(baseFontName, fontMap, true, false)
        const italicFontName = getFontVariantName(baseFontName, fontMap, false, true)
        const boldItalicFontName = getFontVariantName(baseFontName, fontMap, true, true)

        const baseFontData = await toUint8Array(fontMap[baseFontName]?.data)
        const boldFontData = await toUint8Array((fontMap[boldFontName] || fontMap[baseFontName])?.data)
        const italicFontData = await toUint8Array((fontMap[italicFontName] || fontMap[baseFontName])?.data)
        const boldItalicFontData = await toUint8Array((fontMap[boldItalicFontName] || fontMap[boldFontName] || fontMap[baseFontName])?.data)

        if (
            boldRanges.length === 0 &&
            fontSizeRanges.length === 0 &&
            italicRanges.length === 0 &&
            underlineRanges.length === 0 &&
            strikeRanges.length === 0
        ) {
            await textPlugin.pdf({
                value: processedText,
                schema: schema as unknown as Parameters<typeof textPlugin.pdf>[0]['schema'],
                ...rest,
            })
            return
        }

        const normalFont = await pdfDoc.embedFont(baseFontData, { subset: true })
        const boldFont = await pdfDoc.embedFont(boldFontData, { subset: true })
        const italicFont = await pdfDoc.embedFont(italicFontData, { subset: true })
        const boldItalicFont = await pdfDoc.embedFont(boldItalicFontData, { subset: true })

        const getFontForStyle = (isBold: boolean, isItalic: boolean) => {
            if (isBold && isItalic) return boldItalicFont
            if (isBold) return boldFont
            if (isItalic) return italicFont
            return normalFont
        }

        const lineHeight = schema.lineHeight || 1
        const charSpacing = schema.characterSpacing || 0
        const color = hexToPdfColor(schema.fontColor, pdfLib)

        const x = mm2pt(schema.position.x)
        const yTop = mm2pt(schema.position.y)
        const width = mm2pt(schema.width)
        const height = mm2pt(schema.height)
        const pageHeight = page.getHeight()

        const lines = splitLinesForMixedText(
            processedText,
            width,
            baseFontSize,
            charSpacing,
            getFontForStyle,
            boldRanges,
            fontSizeRanges,
            italicRanges,
            underlineRanges,
            strikeRanges,
        )

        const lineMetrics = lines.map((line) => {
            const maxFontSize = line.reduce((max, entry) => Math.max(max, entry.fontSize), baseFontSize)
            return {
                maxFontSize,
                lineHeightPt: maxFontSize * lineHeight,
            }
        })
        const contentHeight = lineMetrics.reduce((sum, metric) => sum + metric.lineHeightPt, 0)
        const verticalOffset = Math.max(0, height - contentHeight)

        let contentTop = pageHeight - yTop
        if (schema.verticalAlignment === 'middle') {
            contentTop = pageHeight - yTop - verticalOffset / 2
        } else if (schema.verticalAlignment === 'bottom') {
            contentTop = pageHeight - yTop - verticalOffset
        }

        let consumedHeight = 0
        lines.forEach((line, rowIndex) => {
            const metric = lineMetrics[rowIndex]
            const lineY = contentTop - consumedHeight - metric.maxFontSize
            if (line.length === 0) {
                consumedHeight += metric.lineHeightPt
                return
            }
            const totalLineWidth = line.reduce((acc, c) => acc + c.width + charSpacing, 0) - charSpacing;

            let cursorX = x;
            if (schema.alignment === 'center') cursorX += (width - totalLineWidth) / 2;
            else if (schema.alignment === 'right') cursorX += width - totalLineWidth;

            line.forEach((entry) => {
                const font = getFontForStyle(entry.bold, entry.italic)
                const lineThickness = Math.max(0.5, entry.fontSize * 0.05)
                if (entry.char.trim() !== "") {
                    page.drawText(entry.char, {
                        x: cursorX,
                        y: lineY,
                        size: entry.fontSize,
                        font,
                        color,
                        opacity: schema.opacity ?? 1,
                    });
                }

                const startX = cursorX
                const endX = cursorX + entry.width
                if (entry.underline) {
                    page.drawLine({
                        start: { x: startX, y: lineY - entry.fontSize * 0.12 },
                        end: { x: endX, y: lineY - entry.fontSize * 0.12 },
                        thickness: lineThickness,
                        color,
                        opacity: schema.opacity ?? 1,
                    })
                }
                if (entry.strike) {
                    page.drawLine({
                        start: { x: startX, y: lineY + entry.fontSize * 0.3 },
                        end: { x: endX, y: lineY + entry.fontSize * 0.3 },
                        thickness: lineThickness,
                        color,
                        opacity: schema.opacity ?? 1,
                    })
                }

                cursorX += entry.width + charSpacing;
            });

            consumedHeight += metric.lineHeightPt
        });
    },

    ui: async (arg: UIRenderProps<TextWithVariablesSchema>) => {
        const { rootElement, schema, onChange, mode, value, tabIndex, placeholder, stopEditing, theme } = arg

        const rawText = schema.text || ""
        const initialHtml = (schema.content && schema.content.trim().length > 0) ? schema.content : rawText
        const initialPlainText = stripHtmlTags(initialHtml)
        
        const variables = extractVariables(initialPlainText)
        const currentVariables = Array.isArray(schema.variables) ? schema.variables : []
        if (mode === 'designer' && JSON.stringify(variables) !== JSON.stringify(currentVariables)) {
            if (onChange) {
                onChange({ key: 'variables', value: variables })
            }
        }

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

        const isEditableMode = mode === 'designer'
        const normalizedSchemaBoldRanges = normalizeBoldRanges(schema.bold)
        const baseFontSize = schema.fontSize || 12
        const normalizedSchemaFontSizeRanges = normalizeFontSizeRanges(schema.fontSizeRanges)
        const normalizedSchemaItalicRanges = normalizeStyleRanges(schema.italicRanges)
        const normalizedSchemaUnderlineRanges = normalizeStyleRanges(schema.underlineRanges)
        const normalizedSchemaStrikeRanges = normalizeStyleRanges(schema.strikeRanges)
        const parsedRawText = parseVariablesWithMapping(rawText, valueData)
        const projectedReadOnlyBoldRanges = projectBoldRangesBySourceMap(
            normalizedSchemaBoldRanges,
            parsedRawText.sourceIndexByOutputIndex,
        )
        const projectedReadOnlyFontSizeRanges = projectFontSizeRangesBySourceMap(
            normalizedSchemaFontSizeRanges,
            parsedRawText.sourceIndexByOutputIndex,
            baseFontSize,
        )
        const projectedReadOnlyItalicRanges = projectStyleRangesBySourceMap(
            normalizedSchemaItalicRanges,
            parsedRawText.sourceIndexByOutputIndex,
        )
        const projectedReadOnlyUnderlineRanges = projectStyleRangesBySourceMap(
            normalizedSchemaUnderlineRanges,
            parsedRawText.sourceIndexByOutputIndex,
        )
        const projectedReadOnlyStrikeRanges = projectStyleRangesBySourceMap(
            normalizedSchemaStrikeRanges,
            parsedRawText.sourceIndexByOutputIndex,
        )
        let displayHtml = isEditableMode
            ? initialHtml
            : (schema.content ? applyVariablesToHtml(schema.content, valueData) : parsedRawText.text)

        if (
            (isEditableMode && (
                normalizedSchemaBoldRanges.length > 0 ||
                normalizedSchemaFontSizeRanges.length > 0 ||
                normalizedSchemaItalicRanges.length > 0 ||
                normalizedSchemaUnderlineRanges.length > 0 ||
                normalizedSchemaStrikeRanges.length > 0
            )) ||
            (!isEditableMode && (
                projectedReadOnlyBoldRanges.length > 0 ||
                projectedReadOnlyFontSizeRanges.length > 0 ||
                projectedReadOnlyItalicRanges.length > 0 ||
                projectedReadOnlyUnderlineRanges.length > 0 ||
                projectedReadOnlyStrikeRanges.length > 0
            ))
        ) {
            const plainText = stripHtmlTags(displayHtml)
            displayHtml = renderStyledRanges(
                plainText,
                isEditableMode ? normalizedSchemaBoldRanges : projectedReadOnlyBoldRanges,
                isEditableMode ? normalizedSchemaFontSizeRanges : projectedReadOnlyFontSizeRanges,
                baseFontSize,
                isEditableMode ? normalizedSchemaItalicRanges : projectedReadOnlyItalicRanges,
                isEditableMode ? normalizedSchemaUnderlineRanges : projectedReadOnlyUnderlineRanges,
                isEditableMode ? normalizedSchemaStrikeRanges : projectedReadOnlyStrikeRanges,
            )
        }

        rootElement.innerHTML = ''

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
            textBlock.innerHTML = displayHtml
            return
        }

        makeElementPlainTextContentEditable(textBlock)
        textBlock.tabIndex = tabIndex || 0
        textBlock.innerHTML = displayHtml

        const getText = (element: HTMLDivElement) => {
            let text = element.innerText
            if (text.endsWith('\n')) {
                text = text.slice(0, -1)
            }
            return text
        }

        let activeBoldRanges = normalizedSchemaBoldRanges.map((range) => ({ ...range }))
        let activeFontSizeRanges = normalizedSchemaFontSizeRanges.map((range) => ({ ...range }))
        let activeItalicRanges = normalizedSchemaItalicRanges.map((range) => ({ ...range }))
        let activeUnderlineRanges = normalizedSchemaUnderlineRanges.map((range) => ({ ...range }))
        let activeStrikeRanges = normalizedSchemaStrikeRanges.map((range) => ({ ...range }))

        type FormatRangeMap = {
            bold: Array<{ start: number; end: number }>
            fontSizeRanges: Array<{ start: number; end: number; size: number }>
            italicRanges: Array<{ start: number; end: number }>
            underlineRanges: Array<{ start: number; end: number }>
            strikeRanges: Array<{ start: number; end: number }>
        }

        type FormatRangeKey = keyof FormatRangeMap

        const getFormatRanges = (): FormatRangeMap => ({
            bold: activeBoldRanges,
            fontSizeRanges: activeFontSizeRanges,
            italicRanges: activeItalicRanges,
            underlineRanges: activeUnderlineRanges,
            strikeRanges: activeStrikeRanges,
        })

        const setFormatRange = <K extends FormatRangeKey>(key: K, value: FormatRangeMap[K]) => {
            if (key === 'bold') activeBoldRanges = value as FormatRangeMap['bold']
            else if (key === 'fontSizeRanges') activeFontSizeRanges = value as FormatRangeMap['fontSizeRanges']
            else if (key === 'italicRanges') activeItalicRanges = value as FormatRangeMap['italicRanges']
            else if (key === 'underlineRanges') activeUnderlineRanges = value as FormatRangeMap['underlineRanges']
            else activeStrikeRanges = value as FormatRangeMap['strikeRanges']
        }

        const createFormatRangeUpdates = () => {
            const ranges = getFormatRanges()
            return (Object.keys(ranges) as FormatRangeKey[]).map((key) => ({
                key,
                value: ranges[key].map((entry) => ({ ...entry })),
            }))
        }

        const getCaretOffset = (element: HTMLDivElement) => {
            const selection = window.getSelection()
            if (!selection || selection.rangeCount === 0) return 0

            const range = selection.getRangeAt(0).cloneRange()
            range.collapse(true)

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
                    ...createFormatRangeUpdates(),
                ])
            }

            lastText = plainText
        }

        textBlock.addEventListener('blur', () => {
            commitContentChange()
            hideToolbar()
        })

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

        if (mode === 'designer') {
            let dropdown: HTMLDivElement | null = null
            let fieldGroups: FieldGroup[] = []
            let selectedIndex = -1
            let dropdownItems: HTMLDivElement[] = []
            let selectableFieldEntries: DropdownFieldEntry[] = []
            let dropdownKeyListenerAttached = false

            const fetchFields = async () => {
                try {
                    fieldGroups = await fetchAllCustomerListFields()
                } catch {
                }
            }

            fetchFields()

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
            toolbar.addEventListener('mousedown', (event) => {
                event.preventDefault()
                textBlock.focus()
            })

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

            const createSvgIconButton = (svgMarkup: string, ariaLabel: string) => {
                const btn = createIconButton('')
                btn.innerHTML = svgMarkup
                btn.setAttribute('aria-label', ariaLabel)
                btn.style.display = 'inline-flex'
                btn.style.alignItems = 'center'
                btn.style.justifyContent = 'center'

                const svg = btn.querySelector('svg')
                if (svg) {
                    svg.setAttribute('width', '12')
                    svg.setAttribute('height', '12')
                    svg.style.width = '12px'
                    svg.style.height = '12px'
                    svg.style.display = 'block'
                }

                return btn
            }

            const fontSizeDisplay = document.createElement('span')
            fontSizeDisplay.style.padding = '0 4px'
            fontSizeDisplay.style.minWidth = '36px'
            fontSizeDisplay.style.display = 'inline-block'
            fontSizeDisplay.style.textAlign = 'center'

            const getSelectionFontSize = (): number | null => {
                const selection = window.getSelection()
                if (!selection || selection.rangeCount === 0) return baseFontSize

                const range = selection.getRangeAt(0)
                if (range.collapsed) {
                    const caretPos = getCaretOffset(textBlock)
                    return getFontSizeAtIndex(caretPos, activeFontSizeRanges, baseFontSize)
                }

                const textRange = getTextRangeFromSelection()
                if (!textRange) return baseFontSize

                const firstSize = getFontSizeAtIndex(textRange.start, activeFontSizeRanges, baseFontSize)
                for (let index = textRange.start + 1; index <= textRange.end; index++) {
                    const currentSize = getFontSizeAtIndex(index, activeFontSizeRanges, baseFontSize)
                    if (currentSize !== firstSize) {
                        return null
                    }
                }

                return firstSize
            }

            const updateFontSizeDisplay = () => {
                const selectedSize = getSelectionFontSize()
                fontSizeDisplay.textContent = selectedSize === null ? '- px' : `${selectedSize} px`
            }

            const changeFontSize = (delta: number) => {
                const selection = window.getSelection()
                if (!selection || selection.rangeCount === 0) return
                const range = selection.getRangeAt(0)
                if (range.collapsed) return

                const textRange = getTextRangeFromSelection()
                if (!textRange) return

                const currentRanges = activeFontSizeRanges.map((entry) => ({ ...entry }))
                const segments: Array<{ start: number; end: number; size: number }> = []

                let segmentStart = textRange.start
                let segmentSize = getFontSizeAtIndex(segmentStart, currentRanges, baseFontSize)

                for (let index = textRange.start + 1; index <= textRange.end; index++) {
                    const indexSize = getFontSizeAtIndex(index, currentRanges, baseFontSize)
                    if (indexSize !== segmentSize) {
                        segments.push({ start: segmentStart, end: index - 1, size: segmentSize })
                        segmentStart = index
                        segmentSize = indexSize
                    }
                }
                segments.push({ start: segmentStart, end: textRange.end, size: segmentSize })

                let nextRanges = currentRanges
                for (const segment of segments) {
                    nextRanges = setFontSizeRange(
                        segment.start,
                        segment.end,
                        segment.size + delta,
                        nextRanges,
                        baseFontSize,
                    )
                }

                activeFontSizeRanges = nextRanges

                renderContentWithStyles(activeBoldRanges, activeFontSizeRanges)

                if (onChange) {
                    onChange({ key: 'fontSizeRanges', value: getFormatRanges().fontSizeRanges.map((entry) => ({ ...entry })) })
                }

                setTimeout(() => {
                    setSelectionOffsets(textBlock, textRange.start, textRange.end + 1)
                }, 0)

                updateFontSizeDisplay()
                updateToolbarPosition()
            }

            const getTextRangeFromSelection = (): { start: number; end: number } | null => {
                const selection = window.getSelection()
                if (!selection || selection.rangeCount === 0) return null
                
                const range = selection.getRangeAt(0)
                if (range.collapsed) return null

                const fullText = textBlock.innerText || textBlock.textContent || ''
                
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

            const renderContentWithStyles = (
                boldRanges?: Array<{ start: number; end: number }>,
                fontRanges?: Array<{ start: number; end: number; size: number }>,
                italicRanges?: Array<{ start: number; end: number }>,
                underlineRanges?: Array<{ start: number; end: number }>,
                strikeRanges?: Array<{ start: number; end: number }>,
            ) => {
                const plainText = getText(textBlock)
                const resolvedBoldRanges = boldRanges || activeBoldRanges
                const resolvedFontRanges = fontRanges || activeFontSizeRanges
                const resolvedItalicRanges = italicRanges || activeItalicRanges
                const resolvedUnderlineRanges = underlineRanges || activeUnderlineRanges
                const resolvedStrikeRanges = strikeRanges || activeStrikeRanges

                const renderedHtml = renderStyledRanges(
                    plainText,
                    resolvedBoldRanges,
                    resolvedFontRanges,
                    baseFontSize,
                    resolvedItalicRanges,
                    resolvedUnderlineRanges,
                    resolvedStrikeRanges,
                )
                textBlock.innerHTML = renderedHtml
            }

            const toggleBold = () => {
                const selection = window.getSelection()
                if (!selection || selection.rangeCount === 0) return
                const range = selection.getRangeAt(0)
                if (range.collapsed) return

                const textRange = getTextRangeFromSelection()
                if (!textRange) return

                activeBoldRanges = toggleStyleRanges(textRange.start, textRange.end, activeBoldRanges)

                renderContentWithStyles(activeBoldRanges, activeFontSizeRanges)

                if (onChange) {
                    onChange({ key: 'bold', value: getFormatRanges().bold.map((entry) => ({ ...entry })) })
                }

                setTimeout(() => {
                    setSelectionOffsets(textBlock, textRange.start, textRange.end + 1)
                }, 0)

                updateToolbarPosition()
            }

            const toggleStyle = (style: 'italic' | 'underline' | 'strike') => {
                const selection = window.getSelection()
                if (!selection || selection.rangeCount === 0) return
                const range = selection.getRangeAt(0)
                if (range.collapsed) return

                const textRange = getTextRangeFromSelection()
                if (!textRange) return

                if (style === 'italic') {
                    activeItalicRanges = toggleStyleRanges(textRange.start, textRange.end, activeItalicRanges)
                    if (onChange) onChange({ key: 'italicRanges', value: getFormatRanges().italicRanges.map((entry) => ({ ...entry })) })
                } else if (style === 'underline') {
                    activeUnderlineRanges = toggleStyleRanges(textRange.start, textRange.end, activeUnderlineRanges)
                    if (onChange) onChange({ key: 'underlineRanges', value: getFormatRanges().underlineRanges.map((entry) => ({ ...entry })) })
                } else {
                    activeStrikeRanges = toggleStyleRanges(textRange.start, textRange.end, activeStrikeRanges)
                    if (onChange) onChange({ key: 'strikeRanges', value: getFormatRanges().strikeRanges.map((entry) => ({ ...entry })) })
                }

                renderContentWithStyles(
                    activeBoldRanges,
                    activeFontSizeRanges,
                    activeItalicRanges,
                    activeUnderlineRanges,
                    activeStrikeRanges,
                )

                setTimeout(() => {
                    setSelectionOffsets(textBlock, textRange.start, textRange.end + 1)
                }, 0)

                updateToolbarPosition()
            }

            const clearStyleRangeSelection = (
                ranges: Array<{ start: number; end: number }>,
                selectionStart: number,
                selectionEnd: number,
            ) => {
                const result: Array<{ start: number; end: number }> = []

                for (const range of ranges) {
                    if (range.end < selectionStart || range.start > selectionEnd) {
                        result.push({ ...range })
                        continue
                    }

                    if (range.start < selectionStart) {
                        result.push({ start: range.start, end: selectionStart - 1 })
                    }
                    if (range.end > selectionEnd) {
                        result.push({ start: selectionEnd + 1, end: range.end })
                    }
                }

                return result
            }

            const clearSelectionFormatting = () => {
                const selection = window.getSelection()
                if (!selection || selection.rangeCount === 0) return
                const range = selection.getRangeAt(0)
                if (range.collapsed) return

                const textRange = getTextRangeFromSelection()
                if (!textRange) return

                setFormatRange('bold', clearStyleRangeSelection(getFormatRanges().bold, textRange.start, textRange.end))
                setFormatRange('italicRanges', clearStyleRangeSelection(getFormatRanges().italicRanges, textRange.start, textRange.end))
                setFormatRange('underlineRanges', clearStyleRangeSelection(getFormatRanges().underlineRanges, textRange.start, textRange.end))
                setFormatRange('strikeRanges', clearStyleRangeSelection(getFormatRanges().strikeRanges, textRange.start, textRange.end))
                setFormatRange(
                    'fontSizeRanges',
                    setFontSizeRange(
                        textRange.start,
                        textRange.end,
                        baseFontSize,
                        getFormatRanges().fontSizeRanges,
                        baseFontSize,
                    ),
                )

                renderContentWithStyles(
                    getFormatRanges().bold,
                    getFormatRanges().fontSizeRanges,
                    getFormatRanges().italicRanges,
                    getFormatRanges().underlineRanges,
                    getFormatRanges().strikeRanges,
                )

                if (onChange) {
                    onChange(createFormatRangeUpdates())
                }

                setTimeout(() => {
                    setSelectionOffsets(textBlock, textRange.start, textRange.end + 1)
                }, 0)

                updateFontSizeDisplay()
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
                e.preventDefault()
                textBlock.focus()
            }
            boldButton.onclick = (e) => {
                e.preventDefault()
                textBlock.focus()

                setTimeout(() => {
                    toggleBold()
                }, 10)
            }

            const italicButton = createIconButton('I')
            italicButton.style.fontStyle = 'italic'
            italicButton.onmousedown = (e) => {
                e.preventDefault()
                textBlock.focus()
            }
            italicButton.onclick = (e) => {
                e.preventDefault()
                toggleStyle('italic')
            }

            const underlineButton = createIconButton('U')
            underlineButton.style.textDecoration = 'underline'
            underlineButton.onmousedown = (e) => {
                e.preventDefault()
                textBlock.focus()
            }
            underlineButton.onclick = (e) => {
                e.preventDefault()
                toggleStyle('underline')
            }

            const strikeButton = createIconButton('S')
            strikeButton.style.textDecoration = 'line-through'
            strikeButton.onmousedown = (e) => {
                e.preventDefault()
                textBlock.focus()
            }
            strikeButton.onclick = (e) => {
                e.preventDefault()
                toggleStyle('strike')
            }

            const decreaseSizeButton = createIconButton('-')
            decreaseSizeButton.onmousedown = (e) => {
                e.preventDefault()
                textBlock.focus()
            }
            decreaseSizeButton.onclick = () => changeFontSize(-1)

            const increaseSizeButton = createIconButton('+')
            increaseSizeButton.onmousedown = (e) => {
                e.preventDefault()
                textBlock.focus()
            }
            increaseSizeButton.onclick = () => changeFontSize(1)

            const clearFormatButton = createSvgIconButton(
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-remove-formatting-icon lucide-remove-formatting"><path d="M4 7V4h16v3"/><path d="M5 20h6"/><path d="M13 4 8 20"/><path d="m15 15 5 5"/><path d="m20 15-5 5"/></svg>',
                'Clear formatting',
            )
            clearFormatButton.onmousedown = (e) => {
                e.preventDefault()
                textBlock.focus()
            }
            clearFormatButton.onclick = (e) => {
                e.preventDefault()
                clearSelectionFormatting()
            }

            toolbar.appendChild(boldButton)
            toolbar.appendChild(italicButton)
            toolbar.appendChild(underlineButton)
            toolbar.appendChild(strikeButton)
            toolbar.appendChild(decreaseSizeButton)
            toolbar.appendChild(fontSizeDisplay)
            toolbar.appendChild(increaseSizeButton)
            toolbar.appendChild(clearFormatButton)

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
