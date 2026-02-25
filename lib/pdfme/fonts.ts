import type { Font } from "@pdfme/common"

const FONT_FILES = {
    InterRegular: "inter-latin-400-normal.woff",
    InterBold: "inter-latin-700-normal.woff",
    InterItalic: "inter-latin-400-italic.woff",
    InterBoldItalic: "inter-latin-700-italic.woff",
    RobotoRegular: "roboto-latin-400-normal.woff",
    RobotoBold: "roboto-latin-700-normal.woff",
    RobotoItalic: "roboto-latin-400-italic.woff",
    RobotoBoldItalic: "roboto-latin-700-italic.woff",
    PoppinsRegular: "poppins-latin-400-normal.woff",
    PoppinsBold: "poppins-latin-700-normal.woff",
    PoppinsItalic: "poppins-latin-400-italic.woff",
    PoppinsBoldItalic: "poppins-latin-700-italic.woff",
    TimesCompatRegular: "tinos-latin-400-normal.woff",
    TimesCompatBold: "tinos-latin-700-normal.woff",
    TimesCompatItalic: "tinos-latin-400-italic.woff",
    TimesCompatBoldItalic: "tinos-latin-700-italic.woff",
} as const

let clientFontCache: Font | null = null
let clientFontPromise: Promise<Font> | null = null

const toUint8Array = (buffer: ArrayBuffer): Uint8Array<ArrayBuffer> =>
    new Uint8Array(buffer) as Uint8Array<ArrayBuffer>

const readClientFontFile = async (fileName: string): Promise<Uint8Array<ArrayBuffer>> => {
    const response = await fetch(`/fonts/${fileName}`)
    if (!response.ok) {
        throw new Error(`Failed to load font file: ${fileName}`)
    }
    return toUint8Array(await response.arrayBuffer())
}

export const getPdfmeClientFont = async (): Promise<Font> => {
    if (clientFontCache) return clientFontCache
    if (clientFontPromise) return clientFontPromise

    clientFontPromise = (async () => {
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
            readClientFontFile(FONT_FILES.InterRegular),
            readClientFontFile(FONT_FILES.InterBold),
            readClientFontFile(FONT_FILES.InterItalic),
            readClientFontFile(FONT_FILES.InterBoldItalic),
            readClientFontFile(FONT_FILES.RobotoRegular),
            readClientFontFile(FONT_FILES.RobotoBold),
            readClientFontFile(FONT_FILES.RobotoItalic),
            readClientFontFile(FONT_FILES.RobotoBoldItalic),
            readClientFontFile(FONT_FILES.PoppinsRegular),
            readClientFontFile(FONT_FILES.PoppinsBold),
            readClientFontFile(FONT_FILES.PoppinsItalic),
            readClientFontFile(FONT_FILES.PoppinsBoldItalic),
            readClientFontFile(FONT_FILES.TimesCompatRegular),
            readClientFontFile(FONT_FILES.TimesCompatBold),
            readClientFontFile(FONT_FILES.TimesCompatItalic),
            readClientFontFile(FONT_FILES.TimesCompatBoldItalic),
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

        clientFontCache = font
        return font
    })()

    try {
        return await clientFontPromise
    } finally {
        clientFontPromise = null
    }
}
