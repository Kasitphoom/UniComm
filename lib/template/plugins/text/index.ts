import { text as textPlugin } from "@pdfme/schemas"
import { withFontStylePropPanel } from "./fontStylePropPanel"

export const Text = {
    ...textPlugin,
    propPanel: withFontStylePropPanel(textPlugin.propPanel),
}

export default Text
