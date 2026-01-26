import { PropPanelWidgetProps } from "@pdfme/common"
import { TextWithVariablesSchema } from "./TextWithVariables"

interface ContactListItem {
    id: string
    name: string
}

interface ApiResponse {
    contactLists: ContactListItem[]
    currentPage: number
    total: number
}

function debounce<T extends (...args: any[]) => void>(func: T, wait: number) {
    let timeout: NodeJS.Timeout
    return function (this: any, ...args: Parameters<T>) {
        clearTimeout(timeout)
        timeout = setTimeout(() => func.apply(this, args), wait)
    }
}

const styles = {
    container: {
        width: "100%",
        position: "relative" as const,
        fontFamily: "sans-serif",
        display: "flex",
        alignItems: "center",
    },
    input: {
        width: "100%",
        padding: "8px 32px 8px 12px",
        border: "1px solid #d9d9d9",
        borderRadius: "8px",
        backgroundColor: "#fff",
        fontSize: "14px",
        outline: "none",
        boxSizing: "border-box" as const,
        transition: "border-color 0.2s",
    },
    icon: {
        position: "absolute" as const,
        right: "10px",
        width: "16px",
        height: "16px",
        pointerEvents: "none" as const,
        color: "#999",
    },
    dropdown: {
        position: "absolute" as const,
        top: "100%",
        left: "0",
        width: "100%",
        maxHeight: "200px",
        overflowY: "auto" as const,
        border: "1px solid #d9d9d9",
        borderRadius: "8px",
        backgroundColor: "#fff",
        zIndex: "1000",
        marginTop: "4px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        display: "none",
    },
    listItem: {
        padding: "8px 12px",
        cursor: "pointer",
        borderBottom: "1px solid #f0f0f0",
        fontSize: "14px",
    },
    loadMoreBtn: {
        width: "100%",
        padding: "8px",
        border: "none",
        background: "#f5f5f5",
        color: "#666",
        cursor: "pointer",
        textAlign: "center" as const,
        fontSize: "12px",
        borderBottomLeftRadius: "8px",
        borderBottomRightRadius: "8px",
    },
    loadingText: {
        padding: "10px",
        textAlign: "center" as const,
        color: "#999",
        fontSize: "12px",
    },
}

export const contactListSelectWidget = (props: PropPanelWidgetProps) => {
    const { rootElement, changeSchemas, activeSchema } = props

    // State
    let currentPage = 1
    let isLoading = false
    let currentQuery = ""
    
    const currentSelection =
        ((activeSchema as any).contactListId as string | undefined) || ""

    // Get selected list name if available
    let selectedListName = ""
    if (currentSelection) {
        // We'll fetch the name or show ID for now
        selectedListName = currentSelection
    }

    // Clear & Setup
    rootElement.innerHTML = ""
    Object.assign(rootElement.style, { width: "100%", marginBottom: "10px" })

    const container = document.createElement("div")
    Object.assign(container.style, styles.container)

    // --- Input Field ---
    const input = document.createElement("input")
    input.type = "text"
    input.placeholder = "Select contact list..."
    input.value = selectedListName
    Object.assign(input.style, styles.input)

    // --- Chevron Icon (SVG) ---
    const iconSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    iconSvg.setAttribute("viewBox", "0 0 24 24")
    iconSvg.setAttribute("fill", "none")
    iconSvg.setAttribute("stroke", "currentColor")
    iconSvg.setAttribute("stroke-width", "2")
    iconSvg.setAttribute("stroke-linecap", "round")
    iconSvg.setAttribute("stroke-linejoin", "round")
    Object.assign(iconSvg.style, styles.icon)

    const iconPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
    iconPath.setAttribute("d", "M6 9l6 6 6-6")
    iconSvg.appendChild(iconPath)

    // --- Dropdown Container ---
    const dropdown = document.createElement("div")
    Object.assign(dropdown.style, styles.dropdown)

    const ul = document.createElement("ul")
    Object.assign(ul.style, { listStyle: "none", padding: "0", margin: "0" })

    const statusArea = document.createElement("div")

    // --- Helper Functions ---

    const showDropdown = () => {
        dropdown.style.display = "block"
        input.style.borderColor = "#4096ff"
        iconSvg.style.transform = "rotate(180deg)"
        iconSvg.style.transition = "transform 0.2s"
        
        if (ul.children.length === 0) {
            fetchData(1, currentQuery, true)
        }
    }

    const hideDropdown = () => {
        setTimeout(() => {
            if (document.activeElement !== input) {
                dropdown.style.display = "none"
                input.style.borderColor = "#d9d9d9"
                iconSvg.style.transform = "rotate(0deg)"
            }
        }, 150)
    }

    const handleSelect = (item: ContactListItem) => {
        input.value = item.name
        currentQuery = item.name
        changeSchemas([
            {
                key: "contactListId",
                value: item.id,
                schemaId: activeSchema.id,
            },
        ])
        dropdown.style.display = "none"
    }

    const renderItems = (items: ContactListItem[], append: boolean) => {
        if (!append) ul.innerHTML = ""

        items.forEach((item) => {
            const li = document.createElement("li")
            Object.assign(li.style, styles.listItem)
            li.textContent = item.name

            li.onmouseenter = () => { li.style.backgroundColor = "#e6f7ff" }
            li.onmouseleave = () => { li.style.backgroundColor = "transparent" }
            li.onmousedown = (e) => {
                e.preventDefault()
                handleSelect(item)
            }
            ul.appendChild(li)
        })
    }

    const renderLoadMore = () => {
        statusArea.innerHTML = ""
        const btn = document.createElement("div")
        btn.textContent = "Load More..."
        Object.assign(btn.style, styles.loadMoreBtn)

        btn.onmouseenter = () => { btn.style.backgroundColor = "#e0e0e0" }
        btn.onmouseleave = () => { btn.style.backgroundColor = "#f5f5f5" }
        btn.onmousedown = (e) => {
            e.preventDefault()
            e.stopPropagation()
            fetchData(currentPage + 1, currentQuery, false)
        }
        statusArea.appendChild(btn)
    }

    const fetchData = async (page: number, query: string, resetList: boolean) => {
        if (isLoading) return
        isLoading = true

        statusArea.innerHTML = ""
        const loadingMsg = document.createElement("div")
        loadingMsg.textContent = "Loading..."
        Object.assign(loadingMsg.style, styles.loadingText)
        statusArea.appendChild(loadingMsg)

        try {
            const encodedQuery = encodeURIComponent(query)
            const response = await fetch(`/api/customer-list?page=${page}&query=${encodedQuery}`)
            
            if (!response.ok) {
                throw new Error("Failed to fetch contact lists")
            }
            
            const json = (await response.json()) as ApiResponse
            const contactLists = json.contactLists || []
            const newItems = Array.isArray(contactLists) ? contactLists : []

            if (newItems.length > 0) {
                renderItems(newItems, !resetList)
                currentPage = page
                renderLoadMore()
            } else {
                if (resetList) ul.innerHTML = ""
                statusArea.innerHTML =
                    '<div style="padding:10px; color:#999; font-size:12px; text-align:center">No results found</div>'
            }
        } catch (err) {
            console.error(err)
            statusArea.innerHTML = '<div style="color:red; padding:10px; font-size:12px;">Error loading data</div>'
        } finally {
            isLoading = false
        }
    }

    // --- Listeners ---
    input.addEventListener("focus", showDropdown)
    input.addEventListener("blur", hideDropdown)

    const handleInput = debounce((e: Event) => {
        const val = (e.target as HTMLInputElement).value
        currentQuery = val
        currentPage = 1
        dropdown.style.display = "block"
        fetchData(1, val, true)
    }, 300)

    input.addEventListener("input", handleInput)

    // --- Assembly ---
    dropdown.appendChild(ul)
    dropdown.appendChild(statusArea)

    container.appendChild(input)
    container.appendChild(iconSvg) 
    container.appendChild(dropdown)
    rootElement.appendChild(container)
}
