/**
 * Section 5.4 — Cryptographic Deduplication (Equation 5.5: v = H(T))
 *
 * White-box tests for the SHA-256 content-addressable storage function.
 *
 * Three properties are verified:
 *   1. Idempotency    — H(T) is identical across repeated calls with the same template.
 *   2. Sensitivity    — Changing a single character in T produces a completely different hash.
 *   3. Key-order independence — The `stable()` helper sorts object keys before hashing,
 *      so two objects that are structurally equal but with different key ordering
 *      must produce the same hash.
 */
import { describe, it, expect } from "vitest"
import { hashTemplate } from "@/lib/draftStore"

// idb-keyval is only used by the draft persistence helpers (loadTemplateDraft,
// saveTemplateDraft) — not by hashTemplate itself. Mock it so the module
// loads cleanly without a real IndexedDB environment.
import { vi } from "vitest"
vi.mock("idb-keyval", () => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
}))

const baseTemplate = {
    schemas: [
        [
            {
                type: "TextWithVariables",
                position: { x: 10, y: 20 },
                width: 100,
                height: 30,
                content: "Hello {{Name}}",
            },
        ],
    ],
    basePdf: { width: 210, height: 297, padding: [10, 10, 10, 10] },
} as any

describe("hashTemplate — idempotency (Equation 5.5)", () => {
    it("returns the same 64-character hex string on every call with identical input", async () => {
        const h1 = await hashTemplate(baseTemplate)
        const h2 = await hashTemplate(baseTemplate)
        const h3 = await hashTemplate(baseTemplate)

        expect(h1).toBe(h2)
        expect(h2).toBe(h3)
        expect(h1).toHaveLength(64) // SHA-256 → 32 bytes → 64 hex chars
    })

    it("produces a valid lowercase hex string", async () => {
        const hash = await hashTemplate(baseTemplate)
        expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })
})

describe("hashTemplate — content sensitivity", () => {
    it("produces a different hash when a single character changes", async () => {
        const modified = {
            ...baseTemplate,
            schemas: [
                [
                    {
                        ...baseTemplate.schemas[0][0],
                        content: "Hello {{Name}}!",  // one extra '!'
                    },
                ],
            ],
        }

        const original = await hashTemplate(baseTemplate)
        const changed = await hashTemplate(modified)

        expect(original).not.toBe(changed)
    })

    it("produces a different hash when a numeric property changes", async () => {
        const modified = {
            ...baseTemplate,
            basePdf: { ...baseTemplate.basePdf, width: 211 },  // 210 → 211
        }

        const original = await hashTemplate(baseTemplate)
        const changed = await hashTemplate(modified)

        expect(original).not.toBe(changed)
    })

    it("produces a different hash for an empty template vs a populated one", async () => {
        const empty = { schemas: [[]], basePdf: { width: 210, height: 297, padding: [0, 0, 0, 0] } } as any
        const hashEmpty = await hashTemplate(empty)
        const hashBase = await hashTemplate(baseTemplate)

        expect(hashEmpty).not.toBe(hashBase)
    })
})

describe("hashTemplate — key-order independence (stable stringify)", () => {
    it("produces identical hashes for objects with the same data but different key order", async () => {
        // The internal `stable()` helper sorts keys recursively before hashing.
        const templateA = {
            basePdf: { width: 210, height: 297, padding: [10, 10, 10, 10] },
            schemas: [[{ type: "image", width: 50, height: 50, position: { x: 0, y: 0 } }]],
        } as any

        const templateB = {
            schemas: [[{ position: { y: 0, x: 0 }, height: 50, type: "image", width: 50 }]],
            basePdf: { padding: [10, 10, 10, 10], height: 297, width: 210 },
        } as any

        expect(await hashTemplate(templateA)).toBe(await hashTemplate(templateB))
    })
})
