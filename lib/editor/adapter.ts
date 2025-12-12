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
import { getParsedComponentBlockSchema, resetParsedComponentBlockSchema, updateComponentBlockTemplate } from "@/features/componentBlocks/componentBlocksSlice"

// Adapter interface for the generic Editor component
export interface EditorAdapter {
    loadParsed: (dispatch: AppDispatch, id: string) => void
    resetParsed: (dispatch: AppDispatch) => void
    updateResource: (
        dispatch: AppDispatch,
        params: { id: string; templateData: Template },
    ) => Promise<TemplateWithUser | ComponentBlockWithUser>,
    selectParsed: (state: RootState) => RootState["templates"]["parsedTemplate"]
    selectDetail: (state: RootState) => RootState["templates"]["detail"]["data"] | RootState["componentBlocks"]["detail"]["data"]
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
        dispatch(getParsedComponentBlockSchema(id))
    },
    resetParsed: (dispatch) => {
        dispatch(resetParsedComponentBlockSchema())
    },
    updateResource: async (dispatch, { id, templateData }) => {
        const action = await dispatch(updateComponentBlockTemplate({ id, templateData }))
        return (action as any).payload
    },
    selectParsed: (state) => state.componentBlocks.parsedSchema,
    selectDetail: (state) => state.componentBlocks.detail.data,
}