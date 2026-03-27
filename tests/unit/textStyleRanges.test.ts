/**
 * Section 5.3.2 — Rich-Text Range Algorithms (Part 1)
 *
 * White-box tests for the style normalization and merging algorithms.
 * These functions implement Algorithm 1: merging and splitting overlapping
 * formatting ranges described as {start, end} or {start, end, size}.
 */
import { describe, it, expect } from "vitest"
import {
    normalizeBoldRanges,
    normalizeStyleRanges,
    normalizeFontSizeRanges,
    toggleStyleRanges,
} from "@/lib/template/plugins/textWithVariables/textStyleRanges"

// ---------------------------------------------------------------------------
// normalizeBoldRanges
// ---------------------------------------------------------------------------

describe("normalizeBoldRanges", () => {
    it("returns empty array for null input", () => {
        expect(normalizeBoldRanges(null)).toEqual([])
    })

    it("returns empty array for empty array input", () => {
        expect(normalizeBoldRanges([])).toEqual([])
    })

    it("filters out non-object entries", () => {
        const input = ["invalid", 42, null, { start: 1, end: 3 }]
        expect(normalizeBoldRanges(input)).toEqual([{ start: 1, end: 3 }])
    })

    it("merges two overlapping ranges (chars 0–5 then 3–8) into a single range", () => {
        // This is the core Algorithm 1 assertion from the dissertation.
        const input = [{ start: 0, end: 5 }, { start: 3, end: 8 }]
        expect(normalizeBoldRanges(input)).toEqual([{ start: 0, end: 8 }])
    })

    it("merges adjacent ranges whose ends are exactly one apart", () => {
        // current.start === last.end + 1 → should merge
        const input = [{ start: 0, end: 3 }, { start: 4, end: 7 }]
        expect(normalizeBoldRanges(input)).toEqual([{ start: 0, end: 7 }])
    })

    it("keeps non-overlapping, non-adjacent ranges separate", () => {
        const input = [{ start: 0, end: 3 }, { start: 5, end: 8 }]
        expect(normalizeBoldRanges(input)).toEqual([
            { start: 0, end: 3 },
            { start: 5, end: 8 },
        ])
    })

    it("sorts unsorted input before merging", () => {
        const input = [{ start: 5, end: 8 }, { start: 0, end: 3 }]
        expect(normalizeBoldRanges(input)).toEqual([
            { start: 0, end: 3 },
            { start: 5, end: 8 },
        ])
    })

    it("merges a chain of three overlapping ranges into one", () => {
        const input = [
            { start: 0, end: 5 },
            { start: 3, end: 8 },
            { start: 6, end: 12 },
        ]
        expect(normalizeBoldRanges(input)).toEqual([{ start: 0, end: 12 }])
    })

    it("clamps negative indices to 0", () => {
        const input = [{ start: -3, end: -1 }]
        expect(normalizeBoldRanges(input)).toEqual([{ start: 0, end: 0 }])
    })

    it("handles a single-element range", () => {
        expect(normalizeBoldRanges([{ start: 4, end: 4 }])).toEqual([{ start: 4, end: 4 }])
    })
})

// ---------------------------------------------------------------------------
// normalizeStyleRanges  (italic / underline / strikethrough — same algorithm)
// ---------------------------------------------------------------------------

describe("normalizeStyleRanges", () => {
    it("merges overlapping ranges identically to normalizeBoldRanges", () => {
        const input = [{ start: 0, end: 5 }, { start: 3, end: 8 }]
        expect(normalizeStyleRanges(input)).toEqual([{ start: 0, end: 8 }])
    })

    it("returns empty array for null", () => {
        expect(normalizeStyleRanges(null)).toEqual([])
    })
})

// ---------------------------------------------------------------------------
// normalizeFontSizeRanges
// ---------------------------------------------------------------------------

describe("normalizeFontSizeRanges", () => {
    it("merges same-size overlapping ranges into one", () => {
        const input = [
            { start: 0, end: 5, size: 14 },
            { start: 3, end: 8, size: 14 },
        ]
        expect(normalizeFontSizeRanges(input)).toEqual([{ start: 0, end: 8, size: 14 }])
    })

    it("does NOT merge adjacent ranges with different sizes", () => {
        const input = [
            { start: 0, end: 4, size: 14 },
            { start: 5, end: 9, size: 18 },
        ]
        const result = normalizeFontSizeRanges(input)
        expect(result).toHaveLength(2)
        expect(result[0].size).toBe(14)
        expect(result[1].size).toBe(18)
    })

    it("enforces the default minimum font size of 6pt", () => {
        const input = [{ start: 0, end: 3, size: 2 }]
        expect(normalizeFontSizeRanges(input)).toEqual([{ start: 0, end: 3, size: 6 }])
    })

    it("respects a custom minimum size override", () => {
        const input = [{ start: 0, end: 3, size: 10 }]
        expect(normalizeFontSizeRanges(input, 12)).toEqual([{ start: 0, end: 3, size: 12 }])
    })

    it("returns empty array for null", () => {
        expect(normalizeFontSizeRanges(null)).toEqual([])
    })
})

// ---------------------------------------------------------------------------
// toggleStyleRanges  (toggle bold/italic/etc on a text selection)
// ---------------------------------------------------------------------------

describe("toggleStyleRanges", () => {
    it("adds a new range when there is no existing coverage", () => {
        const result = toggleStyleRanges(2, 6, [])
        expect(result).toEqual([{ start: 2, end: 6 }])
    })

    it("removes a range that is fully covered (toggle off)", () => {
        const existing = [{ start: 0, end: 10 }]
        const result = toggleStyleRanges(2, 6, existing)
        // Chars 2–6 were covered; toggling should remove that span
        expect(result.every((r) => r.start > 6 || r.end < 2)).toBe(true)
    })

    it("extends an existing range when a partially overlapping range is toggled on", () => {
        const existing = [{ start: 0, end: 4 }]
        // Selecting 3–7 partially overlaps with 0–4; should extend to cover 0–7
        const result = toggleStyleRanges(3, 7, existing)
        expect(result).toEqual([{ start: 0, end: 7 }])
    })

    it("normalises reversed start/end arguments", () => {
        const result = toggleStyleRanges(8, 2, [])
        expect(result).toEqual([{ start: 2, end: 8 }])
    })
})
