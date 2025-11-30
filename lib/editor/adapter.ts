import { Template } from "@pdfme/common"
import { RootState } from "@/store/types"
import { AppDispatch } from "@/store/store"
import {
    getParsedTemplateSchema,
    resetParsedSchema,
    updateTemplate,
} from "@/features/templates/templatesSlice"
import { TemplateWithUser } from "@/types/template"
import { ComponentBlockWithUser } from "@/types/componentBlock"

// Adapter interface for the generic Editor component
export interface EditorAdapter {
    loadParsed: (dispatch: AppDispatch, id: string) => void
    resetParsed: (dispatch: AppDispatch) => void
    updateResource: (
        dispatch: AppDispatch,
        params: { id: string; templateData: Template },
        type: "template" | "componentBlock"
    ) => Promise<TemplateWithUser | ComponentBlockWithUser>,
    selectParsed: (state: RootState) => RootState["templates"]["parsedTemplate"]
    selectDetail: (state: RootState) => RootState["templates"]["detail"]["data"]
}

export const templateAdapter: EditorAdapter = {
    loadParsed: (dispatch, id) => {
        dispatch(getParsedTemplateSchema(id))
    },
    resetParsed: (dispatch) => {
        dispatch(resetParsedSchema())
    },
    updateResource: async (dispatch, { id, templateData }) => {
        const action = await dispatch(updateTemplate({ id, templateData }))
        return (action as any).payload
    },
    selectParsed: (state) => state.templates.parsedTemplate,
    selectDetail: (state) => state.templates.detail.data,
}

export const componentBlockAdapter: EditorAdapter = {
    loadParsed: (dispatch, id) => {
        // 
    },
    resetParsed: (dispatch) => {
        // Implement component block parsed schema reset if needed
    },
    updateResource: async (dispatch, { id, templateData }) => {
        // Implement component block update logic if needed
        return {} as ComponentBlockWithUser
    },
    selectParsed: (state) => state.templates.parsedTemplate, // Adjust if component blocks have separate state
    selectDetail: (state) => state.templates.detail.data, // Adjust if component blocks have separate state
}