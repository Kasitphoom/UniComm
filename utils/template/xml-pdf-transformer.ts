import { Schema, Template } from "@pdfme/common"
import { XMLBuilder, XMLParser } from "fast-xml-parser"
import { migrateTemplateSchemas } from "@/lib/template/plugins/textMigration"

export type XMLOutput = {
    Document: {
        [key: string]: unknown
        "@_width"?: string | number
        "@_height"?: string | number
        Page?: Array<Schema>
    }
}

type ComponentSchemaResolver = (componentName: string) => Promise<Schema[] | null>

const resolveComponentBlocksInItems = async (
    items: Schema[] | undefined,
    resolveComponentSchemas: ComponentSchemaResolver,
    ancestors: string[] = [],
): Promise<Schema[]> => {
    if (!Array.isArray(items)) return []

    const nextItems: Schema[] = []

    for (const item of items) {
        if (!item || typeof item !== "object") {
            nextItems.push(item)
            continue
        }

        if (item.type !== "ComponentBlocks") {
            nextItems.push(item)
            continue
        }

        const componentName = typeof (item as any).componentName === "string"
            ? (item as any).componentName.trim()
            : ""
        const existingSchemas = (item as any).componentSchemas
        let resolvedSchemas = Array.isArray(existingSchemas) ? existingSchemas : undefined

        if (componentName && !ancestors.includes(componentName)) {
            const fetched = await resolveComponentSchemas(componentName)
            if (Array.isArray(fetched) && fetched.length > 0) {
                resolvedSchemas = fetched
            }
        }

        if (Array.isArray(resolvedSchemas)) {
            const resolvedNested = await resolveComponentBlocksInItems(
                resolvedSchemas,
                resolveComponentSchemas,
                componentName ? [...ancestors, componentName] : ancestors,
            )
            if (resolvedNested !== resolvedSchemas || resolvedSchemas !== existingSchemas) {
                nextItems.push({ ...(item as any), componentSchemas: resolvedNested } as Schema)
                continue
            }
        }

        nextItems.push(item)
    }

    return nextItems
}

const resolveComponentBlocksInSchemas = async (
    schemas: Schema[][],
    resolveComponentSchemas?: ComponentSchemaResolver,
): Promise<Schema[][]> => {
    if (!resolveComponentSchemas) return schemas

    return Promise.all(
        schemas.map((pageSchema) => resolveComponentBlocksInItems(pageSchema, resolveComponentSchemas)),
    )
}

// Coerce XML string primitives back to JS primitives
const coerce = (v: unknown): number | string | boolean | unknown => {
    if (typeof v !== "string") return v
    // Allow empty or whitespace-only text explicitly as empty string
    if (v.trim() === "") return ""
    if (v === "true") return true
    if (v === "false") return false
    const n = Number(v)
    return !Number.isNaN(n) ? n : v
}

/**
 * Recursively convert a fast-xml-parser "element body" into a plain JS object.
 * - Attributes (@_k) become properties (with x/y folded into position).
 * - '#text' becomes:
 *    - 'content' when this object also has other keys (top-level-ish)
 *    - primitive (string/number/bool) when this object ONLY has '#text'
 * - Nested tags become nested objects/arrays (recursively).
 */
const xmlBodyToJs = (node: any): any => {
    if (node == null) return undefined
    if (Array.isArray(node)) return node.map(xmlBodyToJs)
    if (typeof node !== "object") return node

    const out: Record<string, any> = {}
    let textOnly: string | number | boolean | unknown | undefined

    for (const [k, v] of Object.entries(node)) {
        if (k === "#text") {
            textOnly = coerce(v)
            continue
        }
        if (k.startsWith("@_")) {
            const attr = k.slice(2)
            if (attr === "x" || attr === "y") {
                out.position = out.position ?? {}
                ;(out.position as any)[attr] = coerce(v)
            } else {
                out[attr] = coerce(v)
            }
            continue
        }
        // Nested element
        out[k] = xmlBodyToJs(v)
    }

    // If the element had ONLY text, return primitive (useful for arrays of primitives).
    if (Object.keys(out).length === 0 && typeof textOnly !== "undefined") {
        return textOnly
    }
    // Otherwise, preserve it as 'content' alongside other props.
    if (typeof textOnly !== "undefined") {
        out.content = textOnly
    }
    return out
}

/**
 * Transform XML into a pdfme Template (reverse of transformTemplateToXml).
 */
export const transformXmlToTemplate = async (
    xmlContent: string,
    options?: { resolveComponentSchemas?: ComponentSchemaResolver }
): Promise<Template> => {
    // Do not ignore empty nodes: alwaysCreateTextNode ensures even empty tags produce a '#text' key
    const parser = new XMLParser({
        ignoreAttributes: false,
        allowBooleanAttributes: true,
        alwaysCreateTextNode: true,
        trimValues: false,
    })
    const parsedXml = parser.parse(xmlContent) as any

    const doc = parsedXml?.Document ?? {}
    const widthAttr = doc["@_width"]
    const heightAttr = doc["@_height"]

    // XML uses centimeters; pdfme expects millimeters (×10).
    const widthMm = Number(widthAttr) ? Number(widthAttr) * 10 : 210
    const heightMm = Number(heightAttr) ? Number(heightAttr) * 10 : 297

    // Normalise Page into an array
    const rawPages = doc.Page
    let pages: any[] = []
    if (Array.isArray(rawPages)) pages = rawPages
    else if (rawPages !== undefined && rawPages !== null) pages = [rawPages]

    const schemas: Schema[][] = pages.map((pageNode) => {
        if (!pageNode || typeof pageNode !== "object") return []
        if (Object.keys(pageNode).length === 0) return [] // explicit empty page

        const pageSchemas: Schema[] = []

        for (const [tag, value] of Object.entries(pageNode)) {
            // Each tag may be a single item or an array of items
            const items = Array.isArray(value) ? value : [value]
            for (const item of items) {
                if (!item || typeof item !== "object") continue

                // Convert this XML element body recursively into plain JS
                const js = xmlBodyToJs(item)

                // Build the schema item. The forward transform groups by `type = tag`,
                // so we set it back here and spread the reconstructed props.
                const schemaItem: any = { type: tag, ...(js ?? {}) }

                // Clean empty position
                if (schemaItem.position) {
                    const pos = schemaItem.position as any
                    if (typeof pos.x !== "number") delete pos.x
                    if (typeof pos.y !== "number") delete pos.y
                    if (!Object.keys(pos).length) delete schemaItem.position
                }

                pageSchemas.push(schemaItem as Schema)
            }
        }

        return pageSchemas
    })

    // Ensure at least one (possibly empty) page
    const normalizedSchemas = schemas.length === 0 ? [[]] : schemas

    const resolvedSchemas = await resolveComponentBlocksInSchemas(
        normalizedSchemas,
        options?.resolveComponentSchemas,
    )

    // Migrate any text schemas to TextWithVariables
    const migratedSchemas = migrateTemplateSchemas(resolvedSchemas)

    const template: Template = {
        schemas: migratedSchemas,
        basePdf: {
            width: widthMm,
            height: heightMm,
            padding: [10, 10, 10, 10],
        },
    }

    return template
}

/**
 * Convert any JS value to an "element body" for fast-xml-parser:
 * - primitives -> { '#text': value }
 * - objects    -> attributes from primitive props, nested elements for objects/arrays
 * - arrays     -> array of element bodies
 *
 * Special cases:
 * - key === 'content' becomes '#text'
 * - key === 'position' is flattened to attributes x/y if object
 * - key === 'attributes' (a map) is merged into attributes
 */
function valueToXmlBody(val: unknown): any {
    if (val == null) return undefined
    if (
        typeof val === "string" ||
        typeof val === "number" ||
        typeof val === "boolean"
    ) {
        return { "#text": val }
    }
    if (Array.isArray(val)) {
        // Array of items -> each item becomes an element body (object or primitive)
        return val.map((v) => valueToXmlBody(v))
    }

    // Object case
    const obj = val as Record<string, unknown>
    const body: Record<string, any> = {}

    for (const [k, v] of Object.entries(obj)) {
        if (v == null) continue

        if (k === "content") {
            // Inner text
            body["#text"] = v
            continue
        }

        if (k === "position" && typeof v === "object" && v !== null) {
            const p = v as Record<string, unknown>
            if (typeof p.x !== "undefined") body["@_x"] = p.x
            if (typeof p.y !== "undefined") body["@_y"] = p.y
            continue
        }

        if (
            k === "attributes" &&
            typeof v === "object" &&
            v !== null &&
            !Array.isArray(v)
        ) {
            for (const [ak, av] of Object.entries(
                v as Record<string, unknown>
            )) {
                if (av == null) continue
                body[`@_${ak}`] = av
            }
            continue
        }

        // Primitive => attribute
        if (
            typeof v === "string" ||
            typeof v === "number" ||
            typeof v === "boolean"
        ) {
            body[`@_${k}`] = v
            continue
        }

        // Array => nested repeated elements
        if (Array.isArray(v)) {
            const arrBody = v.map((item) => valueToXmlBody(item))
            body[k] = arrBody
            continue
        }

        // Nested object => nested element
        body[k] = valueToXmlBody(v)
    }

    return body
}

export const transformTemplateToXml = async (
    template: Template,
    options?: { resolveComponentSchemas?: ComponentSchemaResolver }
): Promise<{xml: string, variables: string[]}> => {
    const bp = template.basePdf
    let widthMm: number
    let heightMm: number

    if (
        typeof bp === "string" ||
        bp instanceof ArrayBuffer ||
        bp instanceof Uint8Array
    ) {
        // Default to A4 (portrait)
        widthMm = 210
        heightMm = 297
    } else {
        widthMm = (bp as any).width
        heightMm = (bp as any).height
    }

    const widthCm = widthMm / 10
    const heightCm = heightMm / 10

    const resolvedSchemas = await resolveComponentBlocksInSchemas(
        template.schemas,
        options?.resolveComponentSchemas,
    )

    // Build Document -> Page[] using recursive conversion per schema item
    const pages = resolvedSchemas.map((pageSchema) => {
        // preserve explicit empty page
        if (Array.isArray(pageSchema) && pageSchema.length === 0) return []

        // Allow pass-through for nested array-of-arrays input
        if (
            Array.isArray(pageSchema) &&
            pageSchema.every((el) => Array.isArray(el))
        ) {
            return pageSchema as any
        }

        // Group by tag (schemaItem.type). Unknown -> 'item'
        const grouped: Record<string, any[]> = {}

        for (const schemaItem of pageSchema) {
            const item = schemaItem as any
            const tag = item.type || "item"

            // Build the element body recursively
            const xmlItem = valueToXmlBody(item)

            // Ensure grouping
            if (!grouped[tag]) grouped[tag] = []
            grouped[tag].push(xmlItem)
        }

        // Collapse singletons for each tag
        const pageNode: Record<string, any> = {}
        for (const [tag, items] of Object.entries(grouped)) {
            pageNode[tag] = items.length === 1 ? items[0] : items
        }
        return pageNode
    })

    // Assemble the final object for fast-xml-parser
    const xmlObj = {
        "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
        Document: {
            "@_width": widthCm,
            "@_height": heightCm,
            Page: pages,
        },
    }

    const builder = new XMLBuilder({ ignoreAttributes: false, suppressBooleanAttributes: false })
    return {xml: builder.build(xmlObj), variables: extractVariablesFromSchema(resolvedSchemas)}
}

export const extractVariablesFromSchema = (schema: Schema[][]): string[] => {
    const variables: string[] = []

    const collectFromItems = (items: Schema[] | undefined) => {
        if (!Array.isArray(items)) return

        for (const item of items) {
            if (!item || typeof item !== "object") continue

            if (item.type === "TextWithVariables") {
                const content = (item as any).variables
                const normalized = Array.isArray(content)
                    ? content
                    : typeof content === "string"
                        ? [content]
                        : []
                for (const variable of normalized) {
                    if (typeof variable === "string") {
                        variables.push(variable)
                    }
                }
                continue
            }

            if (item.type === "ComponentBlocks") {
                const nested = (item as any).componentSchemas
                if (Array.isArray(nested)) {
                    collectFromItems(nested)
                }
            }
        }
    }

    for (const page of schema) {
        collectFromItems(page)
    }

    console.log("Extracted variables from schema:", variables)

    return variables
}
