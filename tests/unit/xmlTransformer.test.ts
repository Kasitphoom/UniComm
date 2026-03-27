/**
 * Section 5.5.2 — XML to Template Transformation (Algorithm 2)
 *
 * White-box tests for the two-way XML ↔ pdfme Template transformation layer.
 *
 * Key behaviours verified:
 *   1. Dimension units: XML stores dimensions in centimetres; pdfme requires
 *      millimetres. The transformer must multiply by 10.
 *   2. Schema reconstruction: XML attributes are mapped back to the correct
 *      schema fields including the nested `position` object.
 *   3. ComponentBlock resolution: deeply nested ComponentBlocks are resolved
 *      via the optional resolver callback (Algorithm 2 main path).
 *   4. Round-trip fidelity: Template → XML → Template preserves all fields.
 */
import { describe, it, expect, vi } from "vitest"
import {
    transformXmlToTemplate,
    transformTemplateToXml,
} from "@/utils/template/xml-pdf-transformer"

// Isolate from the text-migration step so tests are focused on the
// XML parsing logic only.
vi.mock("@/lib/template/plugins/textMigration", () => ({
    migrateTemplateSchemas: (schemas: unknown) => schemas,
}))

// ---------------------------------------------------------------------------
// transformXmlToTemplate
// ---------------------------------------------------------------------------

describe("transformXmlToTemplate — dimension conversion", () => {
    it("converts centimetre attributes to millimetres (×10)", async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document width="21" height="29.7"></Document>`

        const template = await transformXmlToTemplate(xml)

        expect((template.basePdf as any).width).toBe(210)
        expect((template.basePdf as any).height).toBe(297)
    })

    it("defaults to A4 (210×297 mm) when no dimension attributes are present", async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?><Document></Document>`

        const template = await transformXmlToTemplate(xml)

        expect((template.basePdf as any).width).toBe(210)
        expect((template.basePdf as any).height).toBe(297)
    })

    it("handles non-standard page sizes", async () => {
        // Letter: 21.59 cm × 27.94 cm
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document width="21.59" height="27.94"></Document>`

        const template = await transformXmlToTemplate(xml)

        expect((template.basePdf as any).width).toBeCloseTo(215.9, 1)
        expect((template.basePdf as any).height).toBeCloseTo(279.4, 1)
    })
})

describe("transformXmlToTemplate — schema reconstruction", () => {
    it("restores position.x and position.y from XML attributes", async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document width="21" height="29.7">
    <Page>
        <image x="10" y="20" width="100" height="50" />
    </Page>
</Document>`

        const template = await transformXmlToTemplate(xml)

        expect(template.schemas).toHaveLength(1)
        const schema = template.schemas[0][0] as any
        expect(schema.type).toBe("image")
        expect(schema.position).toMatchObject({ x: 10, y: 20 })
        expect(schema.width).toBe(100)
        expect(schema.height).toBe(50)
    })

    it("creates an empty page for an explicit empty Page element", async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document width="21" height="29.7">
    <Page></Page>
</Document>`

        const template = await transformXmlToTemplate(xml)

        expect(template.schemas).toHaveLength(1)
        expect(template.schemas[0]).toEqual([])
    })

    it("coerces string numeric attribute values to numbers", async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document width="21" height="29.7">
    <Page>
        <image x="5" y="10" width="80" height="40" />
    </Page>
</Document>`

        const template = await transformXmlToTemplate(xml)
        const schema = template.schemas[0][0] as any

        expect(typeof schema.position.x).toBe("number")
        expect(typeof schema.position.y).toBe("number")
        expect(typeof schema.width).toBe("number")
    })
})

describe("transformXmlToTemplate — ComponentBlock resolution (Algorithm 2)", () => {
    it("injects componentSchemas when a resolver is provided", async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document width="21" height="29.7">
    <Page>
        <ComponentBlocks componentName="HeaderBlock" />
    </Page>
</Document>`

        const headerSchema = [
            { type: "image", position: { x: 0, y: 0 }, width: 50, height: 20 },
        ]
        const resolver = vi.fn().mockResolvedValue(headerSchema)

        const template = await transformXmlToTemplate(xml, {
            resolveComponentSchemas: resolver,
        })

        expect(resolver).toHaveBeenCalledWith("HeaderBlock")
        const block = template.schemas[0][0] as any
        expect(block.type).toBe("ComponentBlocks")
        expect(block.componentSchemas).toEqual(headerSchema)
    })

    it("resolves a deeply nested ComponentBlock chain", async () => {
        // PageBlock → contains HeaderBlock → contains a leaf image schema
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document width="21" height="29.7">
    <Page>
        <ComponentBlocks componentName="PageBlock" />
    </Page>
</Document>`

        const leafSchema = [{ type: "image", position: { x: 0, y: 0 }, width: 30, height: 15 }]

        const resolver = vi.fn().mockImplementation(async (name: string) => {
            if (name === "PageBlock") {
                return [
                    {
                        type: "ComponentBlocks",
                        componentName: "HeaderBlock",
                    },
                ]
            }
            if (name === "HeaderBlock") return leafSchema
            return null
        })

        const template = await transformXmlToTemplate(xml, {
            resolveComponentSchemas: resolver,
        })

        const outerBlock = template.schemas[0][0] as any
        expect(outerBlock.type).toBe("ComponentBlocks")
        const innerBlock = outerBlock.componentSchemas[0] as any
        expect(innerBlock.type).toBe("ComponentBlocks")
        expect(innerBlock.componentSchemas).toEqual(leafSchema)
    })

    it("leaves ComponentBlocks unchanged when no resolver is provided", async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document width="21" height="29.7">
    <Page>
        <ComponentBlocks componentName="Footer" />
    </Page>
</Document>`

        const template = await transformXmlToTemplate(xml)

        const block = template.schemas[0][0] as any
        expect(block.type).toBe("ComponentBlocks")
        expect(block.componentSchemas).toBeUndefined()
    })
})

// ---------------------------------------------------------------------------
// Round-trip: Template → XML → Template
// ---------------------------------------------------------------------------

describe("transformTemplateToXml → transformXmlToTemplate round-trip", () => {
    it("preserves basePdf dimensions after a full round-trip", async () => {
        const original = {
            schemas: [[{ type: "image", position: { x: 5, y: 5 }, width: 60, height: 30 }]] as any,
            basePdf: { width: 210, height: 297, padding: [10, 10, 10, 10] as any },
        }

        const { xml } = await transformTemplateToXml(original)
        const restored = await transformXmlToTemplate(xml)

        expect((restored.basePdf as any).width).toBe(210)
        expect((restored.basePdf as any).height).toBe(297)
    })

    it("preserves schema position through a round-trip", async () => {
        const original = {
            schemas: [[{ type: "image", position: { x: 15, y: 25 }, width: 80, height: 40 }]] as any,
            basePdf: { width: 210, height: 297, padding: [10, 10, 10, 10] as any },
        }

        const { xml } = await transformTemplateToXml(original)
        const restored = await transformXmlToTemplate(xml)

        const schema = restored.schemas[0][0] as any
        expect(schema.position).toMatchObject({ x: 15, y: 25 })
        expect(schema.width).toBe(80)
        expect(schema.height).toBe(40)
    })
})
