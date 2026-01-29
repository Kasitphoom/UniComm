import { PropPanel, PropPanelWidgetProps } from "@pdfme/common";
import { text as textPlugin } from "@pdfme/schemas";
import { TextWithVariablesSchema } from "./TextWithVariables";

export const TextWithVariablesPropPanel: PropPanel<TextWithVariablesSchema> = {
    schema: (propPanelProps: Omit<PropPanelWidgetProps, "rootElement">) => {
        const parentPropPanel = textPlugin.propPanel;
        const parentSchema =
            typeof parentPropPanel?.schema === "function" ? parentPropPanel.schema(propPanelProps) : {};

        return {
            ...parentSchema,
        };
    },
    widgets: { ...(textPlugin.propPanel?.widgets || {}) },
    defaultSchema: {
        ...(textPlugin.propPanel?.defaultSchema || {}),
        type: "TextWithVariables",
        name: "Text with Variables",
        text: "Add text here using {{}} for variables ",
        content: "{}",
        variables: [],
        readOnly: false,
    } as TextWithVariablesSchema,
};

