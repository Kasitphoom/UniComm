export type BoldRange = { start: number; end: number }
export type StyleRange = { start: number; end: number }
export type FontSizeRange = { start: number; end: number; size: number }

const clampNonNegativeInt = (value: unknown, fallback: number) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return fallback
    return Math.max(0, Math.floor(numeric))
}

const mergeBoldRangesInternal = (ranges: BoldRange[]): BoldRange[] => {
    if (ranges.length === 0) return []

    const sorted = [...ranges].sort((a, b) => a.start - b.start)
    const merged: BoldRange[] = [{ ...sorted[0] }]

    for (let index = 1; index < sorted.length; index++) {
        const current = sorted[index]
        const last = merged[merged.length - 1]

        if (current.start <= last.end + 1) {
            last.end = Math.max(last.end, current.end)
        } else {
            merged.push({ ...current })
        }
    }

    return merged
}

const mergeStyleRangesInternal = (ranges: StyleRange[]): StyleRange[] => {
    if (ranges.length === 0) return []

    const sorted = [...ranges].sort((a, b) => a.start - b.start)
    const merged: StyleRange[] = [{ ...sorted[0] }]

    for (let index = 1; index < sorted.length; index++) {
        const current = sorted[index]
        const last = merged[merged.length - 1]

        if (current.start <= last.end + 1) {
            last.end = Math.max(last.end, current.end)
        } else {
            merged.push({ ...current })
        }
    }

    return merged
}

const mergeFontSizeRangesInternal = (ranges: FontSizeRange[]): FontSizeRange[] => {
    if (ranges.length === 0) return []

    const sorted = [...ranges].sort((a, b) => a.start - b.start)
    const merged: FontSizeRange[] = [{ ...sorted[0] }]

    for (let index = 1; index < sorted.length; index++) {
        const current = sorted[index]
        const last = merged[merged.length - 1]

        if (current.start <= last.end + 1 && current.size === last.size) {
            last.end = Math.max(last.end, current.end)
        } else {
            merged.push({ ...current })
        }
    }

    return merged
}

export const normalizeBoldRanges = (input: unknown): BoldRange[] => {
    if (input == null) return []

    const source = Array.isArray(input) ? input : [input]

    const normalized = source
        .filter((item): item is { start: unknown; end: unknown } =>
            typeof item === 'object' && item !== null && 'start' in item && 'end' in item,
        )
        .map((item) => {
            const safeStart = clampNonNegativeInt(item.start, 0)
            const safeEnd = clampNonNegativeInt(item.end, safeStart)
            return {
                start: Math.min(safeStart, safeEnd),
                end: Math.max(safeStart, safeEnd),
            }
        })

    return mergeBoldRangesInternal(normalized)
}

export const normalizeStyleRanges = (input: unknown): StyleRange[] => {
    if (input == null) return []

    const source = Array.isArray(input) ? input : [input]

    const normalized = source
        .filter((item): item is { start: unknown; end: unknown } =>
            typeof item === 'object' && item !== null && 'start' in item && 'end' in item,
        )
        .map((item) => {
            const safeStart = clampNonNegativeInt(item.start, 0)
            const safeEnd = clampNonNegativeInt(item.end, safeStart)
            return {
                start: Math.min(safeStart, safeEnd),
                end: Math.max(safeStart, safeEnd),
            }
        })

    return mergeStyleRangesInternal(normalized)
}

export const normalizeFontSizeRanges = (input: unknown, minimumSize = 6): FontSizeRange[] => {
    if (input == null) return []

    const source = Array.isArray(input) ? input : [input]

    const normalized = source
        .filter((item): item is { start: unknown; end: unknown; size: unknown } =>
            typeof item === 'object' && item !== null && 'start' in item && 'end' in item && 'size' in item,
        )
        .map((item) => {
            const safeStart = clampNonNegativeInt(item.start, 0)
            const safeEnd = clampNonNegativeInt(item.end, safeStart)
            const size = Math.max(minimumSize, Math.floor(Number(item.size) || minimumSize))
            return {
                start: Math.min(safeStart, safeEnd),
                end: Math.max(safeStart, safeEnd),
                size,
            }
        })

    return mergeFontSizeRangesInternal(normalized)
}

export const isIndexBold = (index: number, ranges: BoldRange[]) =>
    ranges.some((range) => index >= range.start && index <= range.end)

export const isIndexInStyleRanges = (index: number, ranges: StyleRange[]) =>
    ranges.some((range) => index >= range.start && index <= range.end)

export const getFontSizeAtIndex = (index: number, ranges: FontSizeRange[], baseFontSize: number) => {
    for (const range of ranges) {
        if (index >= range.start && index <= range.end) {
            return range.size
        }
    }
    return baseFontSize
}

export const setFontSizeRange = (
    start: number,
    end: number,
    size: number,
    currentRanges: FontSizeRange[],
    baseFontSize: number,
): FontSizeRange[] => {
    const normalizedStart = Math.min(start, end)
    const normalizedEnd = Math.max(start, end)
    const targetSize = Math.max(6, Math.floor(size))

    const nextRanges: FontSizeRange[] = []

    for (const range of currentRanges) {
        if (range.end < normalizedStart || range.start > normalizedEnd) {
            nextRanges.push({ ...range })
            continue
        }

        if (range.start < normalizedStart) {
            nextRanges.push({
                start: range.start,
                end: normalizedStart - 1,
                size: range.size,
            })
        }

        if (range.end > normalizedEnd) {
            nextRanges.push({
                start: normalizedEnd + 1,
                end: range.end,
                size: range.size,
            })
        }
    }

    if (targetSize !== baseFontSize) {
        nextRanges.push({
            start: normalizedStart,
            end: normalizedEnd,
            size: targetSize,
        })
    }

    return mergeFontSizeRangesInternal(nextRanges)
}

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')

export const renderStyledRanges = (
    text: string,
    boldRanges: BoldRange[],
    fontSizeRanges: FontSizeRange[],
    baseFontSize: number,
    italicRanges: StyleRange[] = [],
    underlineRanges: StyleRange[] = [],
    strikeRanges: StyleRange[] = [],
): string => {
    if (text.length === 0) return ''

    let html = ''
    let runText = ''
    let runBold = false
    let runSize = baseFontSize
    let runItalic = false
    let runUnderline = false
    let runStrike = false

    const flushRun = () => {
        if (runText.length === 0) return

        const escapedRun = escapeHtml(runText)
        const styles: string[] = []

        if (runBold) styles.push('font-weight: 700')
        if (runItalic) styles.push('font-style: italic')
        if (runSize !== baseFontSize) styles.push(`font-size: ${runSize}pt`)
        const decorations = [runUnderline ? 'underline' : '', runStrike ? 'line-through' : ''].filter(Boolean)
        if (decorations.length > 0) styles.push(`text-decoration: ${decorations.join(' ')}`)

        if (styles.length === 0) {
            html += escapedRun
        } else {
            html += `<span style="${styles.join('; ')}">${escapedRun}</span>`
        }

        runText = ''
    }

    for (let index = 0; index < text.length; index++) {
        const char = text[index]
        const charBold = isIndexBold(index, boldRanges)
        const charSize = getFontSizeAtIndex(index, fontSizeRanges, baseFontSize)
        const charItalic = isIndexInStyleRanges(index, italicRanges)
        const charUnderline = isIndexInStyleRanges(index, underlineRanges)
        const charStrike = isIndexInStyleRanges(index, strikeRanges)

        if (index === 0) {
            runBold = charBold
            runSize = charSize
            runItalic = charItalic
            runUnderline = charUnderline
            runStrike = charStrike
        }

        if (
            charBold !== runBold ||
            charSize !== runSize ||
            charItalic !== runItalic ||
            charUnderline !== runUnderline ||
            charStrike !== runStrike
        ) {
            flushRun()
            runBold = charBold
            runSize = charSize
            runItalic = charItalic
            runUnderline = charUnderline
            runStrike = charStrike
        }

        runText += char
    }

    flushRun()

    return html
}

export const projectBoldRangesBySourceMap = (
    sourceRanges: BoldRange[],
    sourceIndexByOutputIndex: number[],
): BoldRange[] => {
    const projected: BoldRange[] = []
    let segmentStart: number | null = null

    for (let outputIndex = 0; outputIndex < sourceIndexByOutputIndex.length; outputIndex++) {
        const sourceIndex = sourceIndexByOutputIndex[outputIndex]
        const isBold = isIndexBold(sourceIndex, sourceRanges)

        if (isBold && segmentStart === null) {
            segmentStart = outputIndex
        }

        if (!isBold && segmentStart !== null) {
            projected.push({ start: segmentStart, end: outputIndex - 1 })
            segmentStart = null
        }
    }

    if (segmentStart !== null) {
        projected.push({ start: segmentStart, end: sourceIndexByOutputIndex.length - 1 })
    }

    return normalizeBoldRanges(projected)
}

export const projectStyleRangesBySourceMap = (
    sourceRanges: StyleRange[],
    sourceIndexByOutputIndex: number[],
): StyleRange[] => {
    const projected: StyleRange[] = []
    let segmentStart: number | null = null

    for (let outputIndex = 0; outputIndex < sourceIndexByOutputIndex.length; outputIndex++) {
        const sourceIndex = sourceIndexByOutputIndex[outputIndex]
        const active = isIndexInStyleRanges(sourceIndex, sourceRanges)

        if (active && segmentStart === null) {
            segmentStart = outputIndex
        }

        if (!active && segmentStart !== null) {
            projected.push({ start: segmentStart, end: outputIndex - 1 })
            segmentStart = null
        }
    }

    if (segmentStart !== null) {
        projected.push({ start: segmentStart, end: sourceIndexByOutputIndex.length - 1 })
    }

    return normalizeStyleRanges(projected)
}

export const projectFontSizeRangesBySourceMap = (
    sourceRanges: FontSizeRange[],
    sourceIndexByOutputIndex: number[],
    baseFontSize: number,
): FontSizeRange[] => {
    const projected: FontSizeRange[] = []

    let segmentStart = 0
    let segmentSize = sourceIndexByOutputIndex.length > 0
        ? getFontSizeAtIndex(sourceIndexByOutputIndex[0], sourceRanges, baseFontSize)
        : baseFontSize

    for (let outputIndex = 1; outputIndex < sourceIndexByOutputIndex.length; outputIndex++) {
        const sourceIndex = sourceIndexByOutputIndex[outputIndex]
        const size = getFontSizeAtIndex(sourceIndex, sourceRanges, baseFontSize)

        if (size !== segmentSize) {
            if (segmentSize !== baseFontSize) {
                projected.push({ start: segmentStart, end: outputIndex - 1, size: segmentSize })
            }
            segmentStart = outputIndex
            segmentSize = size
        }
    }

    if (sourceIndexByOutputIndex.length > 0 && segmentSize !== baseFontSize) {
        projected.push({
            start: segmentStart,
            end: sourceIndexByOutputIndex.length - 1,
            size: segmentSize,
        })
    }

    return normalizeFontSizeRanges(projected)
}

const isEntirelyCoveredByRanges = (start: number, end: number, ranges: StyleRange[]): boolean => {
    let currentPos = start
    const sortedRanges = [...ranges].sort((a, b) => a.start - b.start)

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

const getOverlappingRanges = (start: number, end: number, ranges: StyleRange[]): StyleRange[] =>
    ranges.filter((range) => range.start <= end && range.end >= start)

const removeStyleRange = (start: number, end: number, ranges: StyleRange[]): StyleRange[] => {
    const result: StyleRange[] = []

    for (const range of ranges) {
        if (range.end < start || range.start > end) {
            result.push({ ...range })
            continue
        }

        if (range.start < start) {
            result.push({ start: range.start, end: start - 1 })
        }
        if (range.end > end) {
            result.push({ start: end + 1, end: range.end })
        }
    }

    return result
}

const extendStyleRangeToInclude = (start: number, end: number, ranges: StyleRange[]): StyleRange[] => {
    const nonOverlapping = ranges.filter((range) => !(range.start <= end && range.end >= start))
    const overlapping = getOverlappingRanges(start, end, ranges)

    let extendedStart = start
    let extendedEnd = end

    for (const range of overlapping) {
        extendedStart = Math.min(extendedStart, range.start)
        extendedEnd = Math.max(extendedEnd, range.end)
    }

    return mergeStyleRangesInternal([...nonOverlapping, { start: extendedStart, end: extendedEnd }])
}

export const toggleStyleRanges = (
    start: number,
    end: number,
    currentRanges: StyleRange[],
): StyleRange[] => {
    const normalizedStart = Math.min(start, end)
    const normalizedEnd = Math.max(start, end)

    if (isEntirelyCoveredByRanges(normalizedStart, normalizedEnd, currentRanges)) {
        return removeStyleRange(normalizedStart, normalizedEnd, currentRanges)
    }

    const overlaps = getOverlappingRanges(normalizedStart, normalizedEnd, currentRanges)
    if (overlaps.length > 0) {
        return extendStyleRangeToInclude(normalizedStart, normalizedEnd, currentRanges)
    }

    return mergeStyleRangesInternal([...currentRanges, { start: normalizedStart, end: normalizedEnd }])
}
