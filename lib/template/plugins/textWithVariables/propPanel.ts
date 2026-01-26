import { PropPanel, PropPanelSchema, PropPanelWidgetProps } from "@pdfme/common";
import { TextWithVariablesSchema } from "./TextWithVariables";

export const TextWithVariablesPropPanel: PropPanel<TextWithVariablesSchema> = {
    schema: ({ options, activeSchema, i18n }) => {
        const panelSchema: Record<string, PropPanelSchema> = {
            fontSize: {
                type: "number",
                title: "Font Size",
                widget: "inputNumber",
                props: {
                    min: 8,
                    max: 72,
                    step: 1,
                },
            },
            fontColor: {
                type: "string",
                title: "Font Color",
                widget: "color",
            },
            alignment: {
                type: "string",
                title: "Text Alignment",
                widget: "select",
                props: {
                    options: [
                        { label: "Left", value: "left" },
                        { label: "Center", value: "center" },
                        { label: "Right", value: "right" },
                    ],
                },
            },
        }

        return panelSchema
    },
    defaultSchema: {
        type: "TextWithVariables",
        name: "Text with Variables",
        position: { x: 10, y: 10 },
        width: 100,
        height: 20,
        text: "",
        variables: [],
        fontSize: 12,
        fontColor: "#000000",
        alignment: "left",
    } as TextWithVariablesSchema,
}

