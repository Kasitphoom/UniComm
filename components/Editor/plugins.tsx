import {
    text,
    multiVariableText,
    image,
    svg,
    table,
    line,
    rectangle,
    ellipse,
    dateTime,
    date,
    time,
    select,
} from "@pdfme/schemas"
import ComponentBlocks from "@/lib/template/plugins/componentBlocks/ComponentBlocks"
import { TextWithVariables } from "@/lib/template/plugins/textWithVariables"
import Text from "@/lib/template/plugins/text"

export const plugins = {
    text: Text,
    TextWithVariables,
    image,
    svg,
    table,
    line,
    rectangle,
    ellipse,
    dateTime,
    date,
    time,
    select,
    ComponentBlocks,
}
