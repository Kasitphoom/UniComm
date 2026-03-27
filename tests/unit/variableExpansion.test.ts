/**
 * Section 5.3.2 — Rich-Text Range Algorithms (Part 2)
 *
 * White-box tests for Variable Expansion Offsets (Equation 5.1).
 *
 * `parseVariablesWithMapping` (internal to TextWithVariables.ts) builds a
 * `sourceIndexByOutputIndex` array that maps every character in the expanded
 * output string back to its origin position in the raw source template.
 *
 * These tests exercise `projectBoldRangesBySourceMap`, which consumes that
 * mapping to project source-space formatting ranges into the output space.
 * Each source map is constructed by hand to match exactly what the internal
 * algorithm produces for a given template + data pair, so we can assert the
 * projection arithmetic precisely.
 */
import { describe, it, expect } from "vitest"
import {
    projectBoldRangesBySourceMap,
    projectStyleRangesBySourceMap,
    projectFontSizeRangesBySourceMap,
} from "@/lib/template/plugins/textWithVariables/textStyleRanges"

// ---------------------------------------------------------------------------
// Helper — build sourceIndexByOutputIndex for "text {{VAR}} text" expansions
//
// Algorithm (mirrors parseVariablesWithMapping):
//   • Literal chars each push their absolute source index.
//   • Every char of the replacement string pushes the *anchor* index,
//     which is the start of the field name inside the braces
//     (i.e. matchStart + 2 + leftTrimOffset).
// ---------------------------------------------------------------------------

/**
 * Constructs a sourceIndexByOutputIndex array for a simple template that
 * contains exactly one variable token.
 *
 * @param prefix      Literal text before the token (e.g. "Hello ")
 * @param tokenName   Variable name inside braces (e.g. "Name")
 * @param replacement Expanded value (e.g. "Alice")
 * @param suffix      Literal text after the token (e.g. "!")
 */
function buildSourceMap(
    prefix: string,
    tokenName: string,
    replacement: string,
    suffix: string,
): number[] {
    const map: number[] = []

    // Prefix chars map 1-to-1
    for (let i = 0; i < prefix.length; i++) {
        map.push(i)
    }

    // Token: "{{Name}}" — anchor = prefix.length + 2  (skip "{{")
    const tokenStart = prefix.length
    const anchor = tokenStart + 2 // first char of the field name
    for (let i = 0; i < replacement.length; i++) {
        map.push(anchor)
    }

    // Suffix starts at tokenStart + 2 + tokenName.length + 2 (skip "}}")
    const suffixSourceStart = tokenStart + 2 + tokenName.length + 2
    for (let i = 0; i < suffix.length; i++) {
        map.push(suffixSourceStart + i)
    }

    return map
}

// ---------------------------------------------------------------------------
// projectBoldRangesBySourceMap
// ---------------------------------------------------------------------------

describe("projectBoldRangesBySourceMap — Equation 5.1 index shifting", () => {
    it("projects a bold range over a token that expands from 6 to 15 characters", () => {
        // Source:  "Hi {{Token}} bye"  — token = "Token" (5 chars in name, 8 chars total "{{Token}}")
        // Suppose the token expands to "LongReplacementVal" (18 chars).
        // Bold covers the token in source: chars at the anchor index.
        //
        // Source indices:
        //   0-2  = "Hi "
        //   3    = '{' (anchor = 5, i.e. start of 'T' in 'Token')
        //   3-10 = "{{Token}}"
        //   11-  = " bye"
        //
        // After expansion "Hi LongReplacementVal bye":
        //   0-2  = "Hi "           → source 0,1,2
        //   3-20 = replacement(18) → all map to anchor 5
        //   21-  = " bye"          → source 11,12,13,14

        const prefix = "Hi "
        const tokenName = "Token"
        const replacement = "LongReplacementVal" // 18 chars (expanded from 8-char token)
        const suffix = " bye"

        const sourceMap = buildSourceMap(prefix, tokenName, replacement, suffix)

        // Bold the token in source space.
        // Anchor = prefix.length + 2 = 5.  Token in source spans indices 3–10 ("{{Token}}").
        const tokenSourceStart = prefix.length          // 3
        const tokenSourceEnd = tokenSourceStart + 2 + tokenName.length + 2 - 1  // 10
        const sourceRanges = [{ start: tokenSourceStart, end: tokenSourceEnd }]

        const result = projectBoldRangesBySourceMap(sourceRanges, sourceMap)

        // In the output, the token occupies indices 3..(3 + 18 - 1) = 3..20
        expect(result).toEqual([{ start: prefix.length, end: prefix.length + replacement.length - 1 }])
    })

    it("does not shift a bold range that precedes the expanded token", () => {
        // Source: "Hello {{Name}} world"
        // Bold = "Hello" (0–4)
        // Name expands to "Alice" (5 chars)
        const prefix = "Hello"
        const tokenName = "Name"
        const replacement = "Alice"
        const suffix = " world"

        const sourceMap = buildSourceMap(prefix, tokenName, replacement, suffix)
        const sourceRanges = [{ start: 0, end: prefix.length - 1 }]  // bold "Hello"

        const result = projectBoldRangesBySourceMap(sourceRanges, sourceMap)

        // "Hello" maps 1-to-1 (unchanged)
        expect(result).toEqual([{ start: 0, end: prefix.length - 1 }])
    })

    it("correctly shifts a bold range that follows the expanded token", () => {
        // Source: "Hi {{Name}} world"
        // Bold = " world" — starts after the closing "}}"
        const prefix = "Hi "
        const tokenName = "Name"
        const replacement = "Alice"        // 5 chars
        const suffix = " world"

        const sourceMap = buildSourceMap(prefix, tokenName, replacement, suffix)

        // Source index of suffix start
        const suffixSourceStart = prefix.length + 2 + tokenName.length + 2  // "Hi " + "{{" + "Name" + "}}"
        const sourceRanges = [{ start: suffixSourceStart, end: suffixSourceStart + suffix.length - 1 }]

        const result = projectBoldRangesBySourceMap(sourceRanges, sourceMap)

        // In output, suffix starts at prefix.length + replacement.length
        const expectedStart = prefix.length + replacement.length
        expect(result).toEqual([{ start: expectedStart, end: expectedStart + suffix.length - 1 }])
    })

    it("returns empty when source has no bold ranges", () => {
        const sourceMap = buildSourceMap("Hello ", "Name", "Alice", "!")
        expect(projectBoldRangesBySourceMap([], sourceMap)).toEqual([])
    })

    it("handles an empty source map", () => {
        expect(projectBoldRangesBySourceMap([{ start: 0, end: 5 }], [])).toEqual([])
    })
})

// ---------------------------------------------------------------------------
// projectStyleRangesBySourceMap  (same projection logic, different style type)
// ---------------------------------------------------------------------------

describe("projectStyleRangesBySourceMap", () => {
    it("projects an italic range across a variable expansion", () => {
        const prefix = "Dear "
        const tokenName = "FirstName"
        const replacement = "Mr. Jonathan"     // 12 chars
        const suffix = ","

        const sourceMap = buildSourceMap(prefix, tokenName, replacement, suffix)
        const tokenStart = prefix.length
        const tokenEnd = tokenStart + 2 + tokenName.length + 2 - 1
        const sourceRanges = [{ start: tokenStart, end: tokenEnd }]

        const result = projectStyleRangesBySourceMap(sourceRanges, sourceMap)

        expect(result).toEqual([
            { start: prefix.length, end: prefix.length + replacement.length - 1 },
        ])
    })
})

// ---------------------------------------------------------------------------
// projectFontSizeRangesBySourceMap
// ---------------------------------------------------------------------------

describe("projectFontSizeRangesBySourceMap", () => {
    it("maps a large font-size range over an expanded variable", () => {
        const prefix = "Ref: "
        const tokenName = "ID"
        const replacement = "INV-2024-001"   // 12 chars
        const suffix = ""

        const sourceMap = buildSourceMap(prefix, tokenName, replacement, suffix)

        const tokenStart = prefix.length
        const tokenEnd = tokenStart + 2 + tokenName.length + 2 - 1
        const sourceRanges = [{ start: tokenStart, end: tokenEnd, size: 18 }]
        const baseFontSize = 12

        const result = projectFontSizeRangesBySourceMap(sourceRanges, sourceMap, baseFontSize)

        expect(result).toEqual([
            { start: prefix.length, end: prefix.length + replacement.length - 1, size: 18 },
        ])
    })

    it("returns empty projection when the entire text uses the base font size", () => {
        // No font-size ranges means every char is at baseFontSize → nothing to project
        const sourceMap = [0, 1, 2, 3, 4]
        const result = projectFontSizeRangesBySourceMap([], sourceMap, 12)
        expect(result).toEqual([])
    })
})
