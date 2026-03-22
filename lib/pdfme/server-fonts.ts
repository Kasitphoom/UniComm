import { readFile } from "fs/promises"
import path from "path"
import type { Font } from "@pdfme/common"

let serverFontCache: Font | null = null
let serverFontPromise: Promise<Font> | null = null

const readServerFontFile = async (fileName: string) => {
    const filePath = path.join(process.cwd(), "public", "fonts", fileName)
    const fileBuffer = await readFile(filePath)
    const arrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength,
    ) as ArrayBuffer
    return new Uint8Array(arrayBuffer) as Uint8Array<ArrayBuffer>
}

export const getPdfmeServerFont = async (): Promise<Font> => {
    if (serverFontCache) return serverFontCache
    if (serverFontPromise) return serverFontPromise

    serverFontPromise = (async () => {
        const [
            interRegular,
            interBold,
            interItalic,
            interBoldItalic,
            robotoRegular,
            robotoBold,
            robotoItalic,
            robotoBoldItalic,
            poppinsRegular,
            poppinsBold,
            poppinsItalic,
            poppinsBoldItalic,
            timesRegular,
            timesBold,
            timesItalic,
            timesBoldItalic,
        ] = await Promise.all([
            readServerFontFile("inter-latin-400-normal.woff"),
            readServerFontFile("inter-latin-700-normal.woff"),
            readServerFontFile("inter-latin-400-italic.woff"),
            readServerFontFile("inter-latin-700-italic.woff"),
            readServerFontFile("roboto-latin-400-normal.woff"),
            readServerFontFile("roboto-latin-700-normal.woff"),
            readServerFontFile("roboto-latin-400-italic.woff"),
            readServerFontFile("roboto-latin-700-italic.woff"),
            readServerFontFile("poppins-latin-400-normal.woff"),
            readServerFontFile("poppins-latin-700-normal.woff"),
            readServerFontFile("poppins-latin-400-italic.woff"),
            readServerFontFile("poppins-latin-700-italic.woff"),
            readServerFontFile("tinos-latin-400-normal.woff"),
            readServerFontFile("tinos-latin-700-normal.woff"),
            readServerFontFile("tinos-latin-400-italic.woff"),
            readServerFontFile("tinos-latin-700-italic.woff"),
        ])

        const font: Font = {
            "Inter": { data: interRegular, fallback: true },
            "Inter-Regular": { data: interRegular },
            "Inter-Bold": { data: interBold },
            "Inter-Italic": { data: interItalic },
            "Inter-BoldItalic": { data: interBoldItalic },

            "Roboto": { data: robotoRegular },
            "Roboto-Regular": { data: robotoRegular },
            "Roboto-Bold": { data: robotoBold },
            "Roboto-Italic": { data: robotoItalic },
            "Roboto-BoldItalic": { data: robotoBoldItalic },

            "Poppins": { data: poppinsRegular },
            "Poppins-Regular": { data: poppinsRegular },
            "Poppins-Bold": { data: poppinsBold },
            "Poppins-Italic": { data: poppinsItalic },
            "Poppins-BoldItalic": { data: poppinsBoldItalic },

            "Times New Roman": { data: timesRegular },
            "Times New Roman-Regular": { data: timesRegular },
            "Times New Roman-Bold": { data: timesBold },
            "Times New Roman-Italic": { data: timesItalic },
            "Times New Roman-BoldItalic": { data: timesBoldItalic },
        }

        serverFontCache = font
        return font
    })()

    try {
        return await serverFontPromise
    } finally {
        serverFontPromise = null
    }
}
