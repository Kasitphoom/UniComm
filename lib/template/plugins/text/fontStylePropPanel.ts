import { DEFAULT_FONT_NAME, getFallbackFontName, PropPanel, PropPanelWidgetProps, Schema } from "@pdfme/common"

type FontStylePreset = "normal" | "bold" | "italic" | "boldItalic"

const isBoldName = (fontName: string) => /bold/.test(fontName.toLowerCase())
const isItalicName = (fontName: string) => /(italic|oblique)/.test(fontName.toLowerCase())

const normalizeFamily = (fontName: string) =>
    fontName
        .replace(/[-_\s]?(regular|bolditalic|boldoblique|bold|italic|oblique)\b/gi, "")
        .trim()

const getFontStylePreset = (fontName?: string): FontStylePreset => {
    if (!fontName) return "normal"
    const hasBold = isBoldName(fontName)
    const hasItalic = isItalicName(fontName)

    if (hasBold && hasItalic) return "boldItalic"
    if (hasBold) return "bold"
    if (hasItalic) return "italic"
    return "normal"
}

const matchesStyle = (fontName: string, style: FontStylePreset) => {
    const hasBold = isBoldName(fontName)
    const hasItalic = isItalicName(fontName)

    if (style === "normal") return !hasBold && !hasItalic
    if (style === "bold") return hasBold && !hasItalic
    if (style === "italic") return !hasBold && hasItalic
    return hasBold && hasItalic
}

const resolveFontNameByStyle = (
    fontNames: string[],
    currentFontName: string,
    fallbackFontName: string,
    targetStyle: FontStylePreset,
) => {
    const currentFamily = normalizeFamily(currentFontName)
    const familyCandidates = fontNames.filter(
        (fontName) => normalizeFamily(fontName) === currentFamily,
    )

    const candidatePool = familyCandidates.length > 0 ? familyCandidates : fontNames

    const exactMatch = candidatePool.find((fontName) =>
        matchesStyle(fontName, targetStyle),
    )
    if (exactMatch) return exactMatch

    if (targetStyle === "normal") {
        const regularMatch = candidatePool.find((fontName) =>
            /regular/i.test(fontName),
        )
        if (regularMatch) return regularMatch
        return fallbackFontName
    }

    return currentFontName
}

const FontStylePresetWidget = (props: PropPanelWidgetProps) => {
    const { rootElement, options, activeSchema, changeSchemas } = props

    const font = options.font || {
        [DEFAULT_FONT_NAME]: { data: "", fallback: true },
    }
    const fontNames = Object.keys(font)
    const fallbackFontName = getFallbackFontName(font)
    const activeSchemaWithFont = activeSchema as { id: string; fontName?: unknown }
    const currentFontName =
        typeof activeSchemaWithFont.fontName === "string" && activeSchemaWithFont.fontName
            ? activeSchemaWithFont.fontName
            : fallbackFontName

    const wrapper = document.createElement("div")
    wrapper.style.display = "flex"
    wrapper.style.flexDirection = "column"
    wrapper.style.gap = "6px"

    const label = document.createElement("label")
    label.innerText = "Font Style"
    label.style.fontSize = "12px"
    label.style.color = "#555"

    const toolbar = document.createElement("div")
    toolbar.style.display = "inline-flex"
    toolbar.style.border = "1px solid #d9d9d9"
    toolbar.style.borderRadius = "8px"
    toolbar.style.overflow = "hidden"
    toolbar.style.width = "fit-content"

    const activeColor = "#7828c8"
    const inactiveColor = "#fff"
    const textColor = "#111"

    let currentPreset: FontStylePreset = getFontStylePreset(currentFontName)

    const resolveAndApplyStyle = (targetStyle: FontStylePreset) => {
        const nextFontName = resolveFontNameByStyle(
            fontNames,
            currentFontName,
            fallbackFontName,
            targetStyle,
        )

        currentPreset = targetStyle
        updateButtonStyles()

        changeSchemas([
            {
                key: "fontName",
                value: nextFontName,
                schemaId: activeSchema.id,
            },
        ])
    }

    const makeButton = (labelText: string, onClick: () => void) => {
        const button = document.createElement("button")
        button.type = "button"
        button.style.width = "36px"
        button.style.height = "32px"
        button.style.border = "none"
        button.style.borderRight = "1px solid #e9e9e9"
        button.style.background = inactiveColor
        button.style.color = textColor
        button.style.cursor = "pointer"
        button.style.fontSize = "15px"
        button.style.display = "inline-flex"
        button.style.alignItems = "center"
        button.style.justifyContent = "center"
        button.innerHTML = labelText
        button.onclick = onClick
        return button
    }

    const boldButton = makeButton("<b>B</b>", () => {
        const makeBold = !(currentPreset === "bold" || currentPreset === "boldItalic")
        const makeItalic = currentPreset === "italic" || currentPreset === "boldItalic"
        const targetStyle: FontStylePreset = makeBold
            ? (makeItalic ? "boldItalic" : "bold")
            : (makeItalic ? "italic" : "normal")
        resolveAndApplyStyle(targetStyle)
    })

    const italicButton = makeButton("<i>I</i>", () => {
        const makeItalic = !(currentPreset === "italic" || currentPreset === "boldItalic")
        const makeBold = currentPreset === "bold" || currentPreset === "boldItalic"
        const targetStyle: FontStylePreset = makeItalic
            ? (makeBold ? "boldItalic" : "italic")
            : (makeBold ? "bold" : "normal")
        resolveAndApplyStyle(targetStyle)
    })

    const clearButton = makeButton("T", () => {
        resolveAndApplyStyle("normal")
    })
    clearButton.style.fontWeight = "400"
    clearButton.style.borderRight = "none"

    const updateButtonStyles = () => {
        const isBold = currentPreset === "bold" || currentPreset === "boldItalic"
        const isItalic = currentPreset === "italic" || currentPreset === "boldItalic"

        boldButton.style.background = isBold ? "rgba(120, 40, 200, 0.12)" : inactiveColor
        boldButton.style.color = isBold ? activeColor : textColor

        italicButton.style.background = isItalic ? "rgba(120, 40, 200, 0.12)" : inactiveColor
        italicButton.style.color = isItalic ? activeColor : textColor

        clearButton.style.background = currentPreset === "normal" ? "rgba(120, 40, 200, 0.12)" : inactiveColor
        clearButton.style.color = currentPreset === "normal" ? activeColor : textColor
    }

    updateButtonStyles()

    toolbar.appendChild(boldButton)
    toolbar.appendChild(italicButton)
    toolbar.appendChild(clearButton)

    wrapper.appendChild(label)
    wrapper.appendChild(toolbar)
    rootElement.appendChild(wrapper)
}

export const withFontStylePropPanel = <T extends Schema>(
    basePropPanel: PropPanel<T>,
    defaultSchemaOverride?: Partial<T>,
): PropPanel<T> => ({
    schema: (propPanelProps) => {
        const parentSchema =
            typeof basePropPanel.schema === "function"
                ? basePropPanel.schema(propPanelProps)
                : basePropPanel.schema

        return {
            ...parentSchema,
            fontStylePreset: {
                type: "string",
                widget: "FontStylePresetWidget",
                bind: false,
                span: 12,
            },
        }
    },
    widgets: {
        ...(basePropPanel.widgets || {}),
        FontStylePresetWidget,
    },
    defaultSchema: {
        ...basePropPanel.defaultSchema,
        ...(defaultSchemaOverride || {}),
    },
})
