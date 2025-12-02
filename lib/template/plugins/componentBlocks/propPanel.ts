import { PropPanel, PropPanelSchema, PropPanelWidgetProps } from "@pdfme/common";
import { ComponentBlocksSchema } from "./ComponentBlocks";
import { componentSelectWidget } from "./ComponentSelectWidget";

export const ComponentBlocksPropPanel: PropPanel<ComponentBlocksSchema> = {
    schema: ({ options, activeSchema, i18n }) => {

        const panelSchema: Record<string, PropPanelSchema> = {
            component: {
                type: "object",
                title: "Change Component Block",
                widget: "componentSelectWidget",
            }
        }

        return panelSchema
    },
    defaultSchema: {
        type: "ComponentBlocks",
        name: "Custom",
        position: { x: 10, y: 10 },
        width: 40,
        height: 20,
        componentSchemas: [],
        componentName: "",
    } as ComponentBlocksSchema,
    widgets: {
        componentSelectWidget,
    }
}