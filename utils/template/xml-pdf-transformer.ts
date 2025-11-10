import { Schema, Template } from "@pdfme/common";
import { XMLBuilder, XMLParser } from "fast-xml-parser";

export type XMLOutput = {
    Document: {
        [key: string]: unknown
        "@_width"?: string | number
        "@_height"?: string | number
        Page?: Array<Schema>
    }
}

// Transform XML into a pdfme Template
export const transformXmlToTemplate = async (xmlContent: string): Promise<Template> => {
    const parser = new XMLParser({ ignoreAttributes: false })
    const parsedXml: XMLOutput = parser.parse(xmlContent)

    const doc = parsedXml?.Document || {}
    const widthAttr = (doc as any)["@_width"]
    const heightAttr = (doc as any)["@_height"]
    // Assume XML uses centimeters; pdfme expects millimeters. Convert cm -> mm (x10).
    const widthMm = Number(widthAttr) ? Number(widthAttr) * 10 : 210
    const heightMm = Number(heightAttr) ? Number(heightAttr) * 10 : 297


    // Normalize pages produced by transformTemplateToXml (array of page objects)
    const rawPages = (doc as any).Page
    // Handle edge cases where an empty page may be represented as '' or null
    let pages: any[] = []
    if (Array.isArray(rawPages)) {
        pages = rawPages
    } else if (rawPages !== undefined && rawPages !== null) {
        // If rawPages is an empty string, treat as a single empty page
        if (rawPages === '') {
            pages = [{}] // Represent one empty page node
        } else {
            pages = [rawPages]
        }
    }

    const schemas: Schema[][] = pages.map((pageNode) => {
        // If pageNode is an empty object (representing an empty page) return [] (page with no items)
        if (!pageNode || typeof pageNode !== 'object') return []
        if (Object.keys(pageNode).length === 0) return []
        const pageSchemas: Schema[] = []
        for (const [tag, value] of Object.entries(pageNode)) {
            const items = Array.isArray(value) ? value : [value]
            for (const item of items) {
                if (!item || typeof item !== 'object') continue
                const schemaItem: any = { type: tag }
                // Iterate properties of the XML item
                for (const [k, v] of Object.entries(item as any)) {
                    if (k === '#text') {
                        schemaItem.content = String(v)
                        continue
                    }
                    if (k.startsWith('@_')) {
                        const attrName = k.slice(2)
                        // Position rebuilding
                        if (attrName === 'x' || attrName === 'y') {
                            schemaItem.position = schemaItem.position || {}
                            const num = typeof v === 'string' ? Number(v) : v
                            if (attrName === 'x') (schemaItem.position as any).x = num
                            else (schemaItem.position as any).y = num
                            continue
                        }
                        // Coerce primitive attribute values
                        let coerced: any = v
                        if (typeof v === 'string') {
                            if (v === 'true') coerced = true
                            else if (v === 'false') coerced = false
                            else if (!isNaN(Number(v)) && v.trim() !== '') coerced = Number(v)
                        }
                        schemaItem[attrName] = coerced
                        continue
                    }
                    // Non-attribute nested data (rare) – keep raw
                    schemaItem[k] = v
                }
                // Clean empty position
                if (schemaItem.position) {
                    const pos = schemaItem.position as any
                    if (typeof pos.x !== 'number') delete pos.x
                    if (typeof pos.y !== 'number') delete pos.y
                    if (!Object.keys(pos).length) delete schemaItem.position
                }
                pageSchemas.push(schemaItem as Schema)
            }
        }
        return pageSchemas
    })

    // If there was at least one raw page but it parsed into zero schemas, ensure we return [[]]
    // This preserves the presence of an empty page rather than no pages.
    const normalizedSchemas = (pages.length > 0 && schemas.length === 0) ? [[]] : schemas.length === 0 ? [[]] : schemas

    const template: Template = {
        schemas: normalizedSchemas,
        basePdf: {
            width: widthMm,
            height: heightMm,
            padding: [10, 10, 10, 10],
        },
    }

    return template
}

export const transformTemplateToXml = async (template: Template): Promise<string> => {
    const bp = template.basePdf
    let widthMm: number
    let heightMm: number

    if (typeof bp === 'string' || bp instanceof ArrayBuffer || bp instanceof Uint8Array) {
        // If basePdf is a raw string/array buffer, we don't have dimensions; default to A4
        widthMm = 210
        heightMm = 297
    } else {
        widthMm = (bp as any).width
        heightMm = (bp as any).height
    }

    const widthCm = widthMm / 10
    const heightCm = heightMm / 10

    // Build XML following recommended schema:
    // <text name="..." x="..." y="..." width="..." ...>content</text>
    // Scalar props become attributes; content -> inner text; position.x/y flattened.
    const xmlParts = {
        '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
        Document: {
            "@_width": widthCm,
            "@_height": heightCm,
            Page: template.schemas.map((pageSchema) => {
                // If pageSchema is an explicitly empty array, preserve it as []
                if (Array.isArray(pageSchema) && pageSchema.length === 0) {
                    return []
                }
                // If pageSchema is a nested array (array of arrays), return as-is
                if (Array.isArray(pageSchema) && pageSchema.every((el) => Array.isArray(el))) {
                    return pageSchema as any
                }
                const grouped: Record<string, any[]> = {}
                for (const schemaItem of pageSchema) {
                    const tag = (schemaItem as any).type || 'item'
                    const itemObj: any = schemaItem as any
                    const xmlItem: Record<string, any> = {}

                    // helper to set attribute (fast-xml-parser requires '@_' prefix)
                    const setAttr = (key: string, val: unknown) => {
                        if (val === undefined || val === null || val === '') return
                        xmlItem[`@_${key}`] = val
                    }

                    // Extract content (display text)
                    const content = itemObj.content

                    // Flatten position
                    if (itemObj.position && typeof itemObj.position === 'object') {
                        setAttr('x', (itemObj.position as any).x)
                        setAttr('y', (itemObj.position as any).y)
                    }

                    // Derive scalar keys dynamically from Schema instance properties
                    const scalarKeys = Object.keys(itemObj).filter((key) => {
                        if (['type','content','position','attributes'].includes(key)) return false
                        const val = itemObj[key]
                        // We consider primitives & simple values (string, number, boolean) as scalar
                        return (
                            typeof val === 'string' ||
                            typeof val === 'number' ||
                            typeof val === 'boolean'
                        )
                    })
                    for (const key of scalarKeys) setAttr(key, itemObj[key])

                    // Custom attributes map (if present)
                    const attrs = (itemObj as { attributes?: Record<string, unknown> }).attributes
                    if (attrs && typeof attrs === 'object') {
                        for (const [attrKey, attrVal] of Object.entries(attrs)) {
                            setAttr(attrKey, attrVal)
                        }
                    }

                    // Add inner text if content exists (fast-xml-parser uses '#text')
                    if (typeof content === 'string' && content.length > 0) {
                        xmlItem['#text'] = content
                    }

                    if (!grouped[tag]) grouped[tag] = []
                    grouped[tag].push(xmlItem)
                }

                // Collapse grouped items: single -> object, multiple -> array
                const pageNode: Record<string, any> = {}
                for (const [tag, items] of Object.entries(grouped)) {
                    pageNode[tag] = items.length === 1 ? items[0] : items
                }
                return pageNode
            })
        }
    }

    const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
        suppressEmptyNode: true,
    })

    const xmlContent = builder.build(xmlParts)
    return xmlContent
}