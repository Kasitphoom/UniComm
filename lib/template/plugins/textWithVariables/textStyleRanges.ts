export type BoldRange = { start: number; end: number }
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
): string => {
    if (text.length === 0) return ''

    let html = ''
    let runText = ''
    let runBold = false
    let runSize = baseFontSize

    const flushRun = () => {
        if (runText.length === 0) return

        const escapedRun = escapeHtml(runText)
        const styles: string[] = []

        if (runBold) styles.push('font-weight: 700')
        if (runSize !== baseFontSize) styles.push(`font-size: ${runSize}pt`)

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

        if (index === 0) {
            runBold = charBold
            runSize = charSize
        }

        if (charBold !== runBold || charSize !== runSize) {
            flushRun()
            runBold = charBold
            runSize = charSize
        }

        runText += char
    }

    flushRun()

    return html
}
