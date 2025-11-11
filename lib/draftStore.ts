import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval"
import type { Template } from "@pdfme/common"

// stable stringify so we can hash/compare reliably
const stable = (v: any): string => {
    const recur = (x: any): any => {
        if (x === null || typeof x !== "object") return x
        if (Array.isArray(x)) return x.map(recur)
        return Object.keys(x)
            .sort()
            .reduce((o, k) => ((o[k] = recur(x[k])), o), {} as any)
    }
    return JSON.stringify(recur(v))
}

export const loadTemplateDraft = (id: string) =>
    idbGet<Template>(`tpl:${id}:template`)

export const saveTemplateDraft = (id: string, tpl: Template) =>
    idbSet(`tpl:${id}:template`, tpl)

export const clearTemplateDraft = (id: string) => idbDel(`tpl:${id}:template`)

export const hashTemplate = async (tpl: Template) => {
    const s = stable(tpl)
    const buf = new TextEncoder().encode(s)
    const digest = await crypto.subtle.digest("SHA-256", buf)
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
}
