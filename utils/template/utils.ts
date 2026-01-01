import { TemplateWithUser } from "@/types/template"
import { Template } from "@pdfme/common"

export const clientFetchTemplate = async (id: string) => {
    const response = await fetch(`/api/templates/${id}`, {
        credentials: 'include',
    })
    if (!response.ok) {
        throw new Error(`Failed to fetch template: ${response.statusText}`)
    }
    const template = (await response.json()) as TemplateWithUser
    return template
}

export const clientFetchParsedTemplate = async (id: string) => {
    
    const responseParsed = await fetch(`/api/templates/${id}/parser`, {
        credentials: 'include',
    })
    if (!responseParsed.ok) {
        throw new Error(`Failed to fetch parsed template: ${responseParsed.statusText}`)
    }
    const parsedContent = await responseParsed.json()

    return parsedContent.data as Template
}