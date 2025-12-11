import type { Plugin, Schema } from "@pdfme/common"
import { createSvgStr } from "@pdfme/schemas/utils"
import { Blocks } from "lucide"
import type { UIRenderProps } from "@pdfme/common"
import { text, multiVariableText, image, svg, table, line, rectangle, ellipse, dateTime, date, time, select, radioGroup } from '@pdfme/schemas'
import { ComponentBlocksPropPanel } from "./propPanel"

export type ComponentBlocksSchema = Schema & {
    componentSchemas?: Array<Schema>
    componentName: string
    isResized?: boolean
}

// Built-in plugin map for rendering child schemas by their `type`
const builtinPluginMap: Record<string, Plugin<any>> = {
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
    radioGroup,
}

type ComponentLookupResponse = {
    componentBlocks?: Array<{ id: string; name: string }>
}

type ComponentTemplateResponse = {
    data?: {
        schemas?: Schema[][]
    }
}

const fetchLatestComponentSchemas = async (componentName?: string): Promise<Schema[] | null> => {
    const normalized = componentName?.trim()
    if (!normalized || typeof window === "undefined" || typeof fetch === "undefined") {
        return null
    }

    try {
        const listResp = await fetch(
            `/api/components?query=${encodeURIComponent(normalized)}&perPage=1`,
            { credentials: "include" }
        )
        if (!listResp.ok) return null
        const listJson = (await listResp.json()) as ComponentLookupResponse
        const candidate = (listJson.componentBlocks || []).find(
            (block) => block.name?.toLowerCase() === normalized.toLowerCase()
        ) || listJson.componentBlocks?.[0]
        if (!candidate?.id) return null

        const parserResp = await fetch(`/api/components/${candidate.id}/parser`, {
            credentials: "include",
        })
        if (!parserResp.ok) return null
        const parserJson = (await parserResp.json()) as ComponentTemplateResponse
        const pageSchemas = parserJson?.data?.schemas?.[0]
        return Array.isArray(pageSchemas) ? (pageSchemas as Schema[]) : null
    } catch (err) {
        console.error("ComponentBlocks: failed to fetch component schema", err)
        return null
    }
}

// Simple square component: draws a gray square in UI and PDF
const ComponentBlocks: Plugin<ComponentBlocksSchema> = {
    pdf: async (arg: any) => {
        const { schema, pdfDoc, pageNumber } = arg as {
            schema: ComponentBlocksSchema
            pdfDoc: any
            pageNumber: number
        }
        const page = pdfDoc.getPages()[pageNumber]
        const { position, width, height } = schema
        if (!position) return

        page.drawRectangle({
            x: position.x,
            y: position.y,
            width,
            height,
            color: [0.9, 0.9, 0.9],
            borderColor: [0.3, 0.3, 0.3],
            borderWidth: 1,
        })
    },

    ui: async (arg: UIRenderProps<ComponentBlocksSchema>) => {
        const { rootElement, schema } = arg

        // Reset root element to avoid duplicate renders
        while (rootElement.firstChild) rootElement.removeChild(rootElement.firstChild)

        const container = document.createElement("div")
        container.style.width = "100%"
        container.style.height = "100%"
        container.style.boxSizing = "border-box"
        container.style.position = "relative"
        rootElement.appendChild(container)

        let children = schema.componentSchemas || []
        const requiresAutoResize = schema.isResized !== true

        if (schema.componentName) {
            const loading = document.createElement("div")
            loading.style.position = "absolute"
            loading.style.inset = "0"
            loading.style.display = "flex"
            loading.style.alignItems = "center"
            loading.style.justifyContent = "center"
            loading.style.fontSize = "10px"
            loading.style.color = "#6b7280"
            loading.textContent = `Loading ${schema.componentName}...`
            container.appendChild(loading)

            const latest = await fetchLatestComponentSchemas(schema.componentName)
            if (container.contains(loading)) {
                container.removeChild(loading)
            }

            if (latest) {
                const prevJson = JSON.stringify(children)
                const nextJson = JSON.stringify(latest)
                if (prevJson !== nextJson) {
                    if (typeof arg.onChange === "function" && arg.mode === "designer") {
                        arg.onChange({ key: "componentSchemas", value: latest })
                    }
                }
                schema.componentSchemas = latest
                children = latest
            }
        }
        if (!children.length) {
            const label = document.createElement("div")
            label.style.position = "absolute"
            label.style.inset = "0"
            label.style.display = "flex"
            label.style.alignItems = "center"
            label.style.justifyContent = "center"
            label.style.fontSize = "10px"
            label.style.color = "#9ca3af"
            label.textContent = schema.name || "Empty group"
            container.appendChild(label)
            return
        }

        // Compute bounding box of all child schemas in mm
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity

        for (const s of children) {
            const pos = (s as any).position
            const w = (s as any).width
            const h = (s as any).height
            if (!pos || typeof w !== "number" || typeof h !== "number") continue
            const x1 = pos.x
            const y1 = pos.y
            const x2 = x1 + w
            const y2 = y1 + h
            minX = Math.min(minX, x1)
            minY = Math.min(minY, y1)
            maxX = Math.max(maxX, x2)
            maxY = Math.max(maxY, y2)
        }

        if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
            return
        }

        const groupWidthMm = Math.max(0.0001, maxX - minX)
        const groupHeightMm = Math.max(0.0001, maxY - minY)

        if (requiresAutoResize) {
            schema.width = groupWidthMm
            schema.height = groupHeightMm
            schema.isResized = true
            if (typeof arg.onChange === "function" && arg.mode === "designer") {
                arg.onChange([
                    { key: "width", value: groupWidthMm },
                    { key: "height", value: groupHeightMm },
                    { key: "isResized", value: true },
                ])
            }
        }

        // Optionally show group bounds overlay
        const overlay = document.createElement("div")
        overlay.style.position = "absolute"
        overlay.style.left = "0%"
        overlay.style.top = "0%"
        overlay.style.width = "100%"
        overlay.style.height = "100%"
        overlay.style.boxSizing = "border-box"
        overlay.style.pointerEvents = "none"
        container.appendChild(overlay)

        // Render each child schema into its own absolutely positioned wrapper
        for (const s of children) {
            const pos = (s as any).position
            const w = (s as any).width
            const h = (s as any).height
            if (!pos || typeof w !== "number" || typeof h !== "number") continue

            const leftPct = ((pos.x - minX) / groupWidthMm) * 100
            const topPct = ((pos.y - minY) / groupHeightMm) * 100
            const widthPct = (w / groupWidthMm) * 100
            const heightPct = (h / groupHeightMm) * 100

            const wrapper = document.createElement("div")
            wrapper.style.position = "absolute"
            wrapper.style.left = `${leftPct}%`
            wrapper.style.top = `${topPct}%`
            wrapper.style.width = `${widthPct}%`
            wrapper.style.height = `${heightPct}%`
            wrapper.style.boxSizing = "border-box"
            container.appendChild(wrapper)

            const type = (s as any).type as string
            const plugin = builtinPluginMap[type]
            if (plugin && typeof plugin.ui === "function") {
                // Delegate rendering to the child's own UI, using wrapper as rootElement
                try {
                    const childValue = (s as any).content ?? (s as any).value ?? ""
                    await plugin.ui({
                        ...(arg as any),
                        schema: s as any,
                        rootElement: wrapper,
                        value: childValue,
                        
                    })
                    console.log("ComponentBlocks: rendered child of type", type)
                } catch (e) {
                    // Fallback: show a simple label if child UI fails
                    console.log("ComponentBlocks: child UI render error", e)
                    const fallback = document.createElement("div")
                    fallback.style.width = "100%"
                    fallback.style.height = "100%"
                    fallback.style.display = "flex"
                    fallback.style.alignItems = "center"
                    fallback.style.justifyContent = "center"
                    fallback.style.fontSize = "10px"
                    fallback.style.color = "#ef4444"
                    fallback.textContent = type || "unknown"
                    wrapper.appendChild(fallback)
                }
            } else {
                const unsupported = document.createElement("div")
                unsupported.style.width = "100%"
                unsupported.style.height = "100%"
                unsupported.style.display = "flex"
                unsupported.style.alignItems = "center"
                unsupported.style.justifyContent = "center"
                unsupported.style.fontSize = "10px"
                unsupported.style.color = "#9ca3af"
                unsupported.textContent = type || "unknown"
                wrapper.appendChild(unsupported)
            }
        }
    },
    propPanel: ComponentBlocksPropPanel,
    icon: createSvgStr(Blocks)
}

export default ComponentBlocks
