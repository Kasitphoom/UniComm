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

export const clientRefreshTemplateDependencies = async (id: string) => {
    const response = await fetch(`/api/templates/${id}/refresh`, {
        method: 'POST',
        credentials: 'include',
    })
    if (!response.ok) {
        throw new Error(`Failed to refresh template dependencies: ${response.statusText}`)
    }
    return (await response.json()) as Pick<TemplateWithUser, 'id' | 'title' | 'filePath' | 'requiredFields'>
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

export const clientFetchParsedComponentBlock = async (id: string) => {
    const responseParsed = await fetch(`/api/components/${id}/parser`, {
        credentials: 'include',
    })
    if (!responseParsed.ok) {
        throw new Error(`Failed to fetch parsed component block: ${responseParsed.statusText}`)
    }
    const parsedContent = await responseParsed.json()

    return parsedContent.data as Template
}