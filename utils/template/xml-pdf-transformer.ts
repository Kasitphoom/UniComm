import { Schema, Template } from "@pdfme/common";
import { XMLParser } from "fast-xml-parser";

export type XMLOutput = {
    Document: {
        [key: string]: unknown
        "@_width"?: string | number
        "@_height"?: string | number
        Page?: any[] | any
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

    // Normalize pages to an array (blank page array length defines schemas pages)
    const rawPages = (doc as any).Page
    const pages: any[] = Array.isArray(rawPages)
        ? rawPages
        : rawPages
        ? [rawPages]
        : [null]

    const schemas: Schema[][] = pages.map(() => [])

    const template: Template = {
        schemas,
        basePdf: {
            width: widthMm,
            height: heightMm,
            padding: [10, 10, 10, 10],
        },
    }

    return template
}