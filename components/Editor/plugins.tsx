import {
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

export const plugins = {
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
