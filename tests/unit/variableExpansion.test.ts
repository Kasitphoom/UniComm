// for dissertation section 5.3.2 — variable expansion offsets
//
// parseVariablesWithMapping is internal to TextWithVariables.ts so we cant
// call it directly. instead we build the sourceIndexByOutputIndex map by hand
// and verify the projection functions consume it correctly.
import { describe, it, expect } from "vitest"
import {
    projectBoldRangesBySourceMap,
    projectStyleRangesBySourceMap,
    projectFontSizeRangesBySourceMap,
} from "@/lib/template/plugins/textWithVariables/textStyleRanges"

// mirrors what parseVariablesWithMapping produces for a single-token template:
//   - literal chars each push their absolute source index
//   - every char of the replacement pushes the anchor index (start of field name inside braces)
function buildSourceMap(
    prefix: string,
    tokenName: string,
    replacement: string,
    suffix: string,
): number[] {
    const map: number[] = []

    for (let i = 0; i < prefix.length; i++) {
        map.push(i)
    }

    const tokenStart = prefix.length
    const anchor = tokenStart + 2 // skip "{{"
    for (let i = 0; i < replacement.length; i++) {
        map.push(anchor)
    }

    const suffixSourceStart = tokenStart + 2 + tokenName.length + 2 // skip "}}"
    for (let i = 0; i < suffix.length; i++) {
        map.push(suffixSourceStart + i)
    }

    return map
}

describe("projectBoldRangesBySourceMap — Equation 5.1 index shifting", () => {
    it("projects a bold range over a token that expands from 6 to 15 characters", () => {
        // source:  "Hi {{Token}} bye"
        // token expands to "LongReplacementVal" (18 chars)
        // all 18 output chars should map back to the token source range
        const prefix = "Hi "
        const tokenName = "Token"
        const replacement = "LongReplacementVal"
        const suffix = " bye"

        const sourceMap = buildSourceMap(prefix, tokenName, replacement, suffix)

        const tokenSourceStart = prefix.length
        const tokenSourceEnd = tokenSourceStart + 2 + tokenName.length + 2 - 1
        const sourceRanges = [{ start: tokenSourceStart, end: tokenSourceEnd }]

        const result = projectBoldRangesBySourceMap(sourceRanges, sourceMap)

        expect(result).toEqual([{ start: prefix.length, end: prefix.length + replacement.length - 1 }])
    })

    it("does not shift a bold range that precedes the expanded token", () => {
        const prefix = "Hello"
        const tokenName = "Name"
        const replacement = "Alice"
        const suffix = " world"

        const sourceMap = buildSourceMap(prefix, tokenName, replacement, suffix)
        const sourceRanges = [{ start: 0, end: prefix.length - 1 }]

        const result = projectBoldRangesBySourceMap(sourceRanges, sourceMap)

        // "Hello" maps 1-to-1 so the range should be unchanged
        expect(result).toEqual([{ start: 0, end: prefix.length - 1 }])
    })

    it("correctly shifts a bold range that follows the expanded token", () => {
        const prefix = "Hi "
        const tokenName = "Name"
        const replacement = "Alice"
        const suffix = " world"

        const sourceMap = buildSourceMap(prefix, tokenName, replacement, suffix)

        const suffixSourceStart = prefix.length + 2 + tokenName.length + 2
        const sourceRanges = [{ start: suffixSourceStart, end: suffixSourceStart + suffix.length - 1 }]

        const result = projectBoldRangesBySourceMap(sourceRanges, sourceMap)

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

describe("projectStyleRangesBySourceMap", () => {
    it("projects an italic range across a variable expansion", () => {
        const prefix = "Dear "
        const tokenName = "FirstName"
        const replacement = "Mr. Jonathan"
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

describe("projectFontSizeRangesBySourceMap", () => {
    it("maps a large font-size range over an expanded variable", () => {
        const prefix = "Ref: "
        const tokenName = "ID"
        const replacement = "INV-2024-001"
        const suffix = ""

        const sourceMap = buildSourceMap(prefix, tokenName, replacement, suffix)

        const tokenStart = prefix.length
        const tokenEnd = tokenStart + 2 + tokenName.length + 2 - 1
        const sourceRanges = [{ start: tokenStart, end: tokenEnd, size: 18 }]

        const result = projectFontSizeRangesBySourceMap(sourceRanges, sourceMap, 12)

        expect(result).toEqual([
            { start: prefix.length, end: prefix.length + replacement.length - 1, size: 18 },
        ])
    })

    it("returns empty projection when the entire text uses the base font size", () => {
        const sourceMap = [0, 1, 2, 3, 4]
        const result = projectFontSizeRangesBySourceMap([], sourceMap, 12)
        expect(result).toEqual([])
    })
})
