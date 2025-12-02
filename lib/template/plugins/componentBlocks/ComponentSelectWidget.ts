import { ComponentBlockListItem } from "@/types/componentBlock"
import { PropPanelWidgetProps } from "@pdfme/common"
import { ComponentBlocksSchema } from "./ComponentBlocks"

interface ApiResponse {
    componentBlocks: ComponentBlockListItem[]
    currentPage: number
    total: number
}

// Simple debounce utility to prevent API flooding
function debounce<T extends (...args: any[]) => void>(func: T, wait: number) {
    let timeout: NodeJS.Timeout
    return function (this: any, ...args: Parameters<T>) {
        clearTimeout(timeout)
        timeout = setTimeout(() => func.apply(this, args), wait)
    }
}

// 2. Styles
const styles = {
    container: {
        width: "100%",
        position: "relative" as const,
        fontFamily: "sans-serif",
    },
    // Changed to look like an input field
    input: {
        width: "100%",
        padding: "8px 12px",
        border: "1px solid #d9d9d9",
        borderRadius: "8px",
        backgroundColor: "#fff",
        fontSize: "14px",
        outline: "none",
        boxSizing: "border-box" as const, // Important for input width
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
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
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
    },
    loadingText: {
        padding: "10px",
        textAlign: "center" as const,
        color: "#999",
        fontSize: "12px",
    },
}

export const componentSelectWidget = (props: PropPanelWidgetProps) => {
    const { rootElement, changeSchemas, activeSchema } = props

    // 1. Setup State
    let currentPage = 1
    let isLoading = false
    let currentQuery = "" // Track the search text
    
    // Get initial value
    const currentSelection =
        (activeSchema as unknown as ComponentBlocksSchema).componentName || ""

    // 2. Clear Container & Apply Styles
    rootElement.innerHTML = ""
    Object.assign(rootElement.style, { width: "100%", marginBottom: "10px" })

    // 3. Create UI Elements
    const container = document.createElement("div")
    Object.assign(container.style, styles.container)

    // --- Input Field (Formerly Display Box) ---
    const input = document.createElement("input")
    input.type = "text"
    input.placeholder = "Search component..."
    input.value = currentSelection // Set initial value
    Object.assign(input.style, styles.input)

    // --- Dropdown Container ---
    const dropdown = document.createElement("div")
    Object.assign(dropdown.style, styles.dropdown)

    // --- List ---
    const ul = document.createElement("ul")
    Object.assign(ul.style, { listStyle: "none", padding: "0", margin: "0" })

    // --- Status / Load More ---
    const statusArea = document.createElement("div")

    // 4. Helper Functions

    const showDropdown = () => {
        dropdown.style.display = "block"
        // If list is empty, fetch initial data
        if (ul.children.length === 0) {
            fetchData(1, currentQuery, true)
        }
    }

    const hideDropdown = () => {
        // specific timeout allows click events on list items to fire before hiding
        setTimeout(() => {
            if (document.activeElement !== input) {
                dropdown.style.display = "none"
            }
        }, 150)
    }

    const handleSelect = (item: ComponentBlockListItem) => {
        // A. Update Input Value
        input.value = item.name
        currentQuery = item.name // Sync query so we don't re-search immediately

        // B. Update PDFME Schema
        changeSchemas([
            {
                key: "componentName",
                value: item.name,
                schemaId: activeSchema.id,
            },
            // Example: Save ID if needed
            // { key: "componentId", value: item.id, schemaId: activeSchema.id }
        ])

        // C. Close Dropdown
        dropdown.style.display = "none"
    }

    const renderItems = (items: ComponentBlockListItem[], append: boolean) => {
        if (!append) {
            ul.innerHTML = "" // Clear list for new searches
        }

        items.forEach((item) => {
            const li = document.createElement("li")
            Object.assign(li.style, styles.listItem)
            li.textContent = item.name

            // Hover effects
            li.onmouseenter = () => { li.style.backgroundColor = "#e6f7ff" }
            li.onmouseleave = () => { li.style.backgroundColor = "transparent" }

            // Click Handler
            li.onmousedown = (e) => {
                e.preventDefault() // Prevent input blur
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

        // Use onmousedown to prevent focus loss issues
        btn.onmousedown = (e) => {
            e.preventDefault() 
            e.stopPropagation()
            fetchData(currentPage + 1, currentQuery, false)
        }
        statusArea.appendChild(btn)
    }

    // Main API Fetch Logic
    const fetchData = async (page: number, query: string, resetList: boolean) => {
        if (isLoading) return
        isLoading = true

        // Show loading state
        statusArea.innerHTML = ""
        const loadingMsg = document.createElement("div")
        loadingMsg.textContent = "Loading..."
        Object.assign(loadingMsg.style, styles.loadingText)
        statusArea.appendChild(loadingMsg)

        try {
            // Encode query parameter
            const encodedQuery = encodeURIComponent(query)
            const response = await fetch(`/api/components?page=${page}&query=${encodedQuery}`)

            const json = (await response.json()) as ApiResponse
            const componentBlocks = json.componentBlocks || []
            
            const newItems = Array.isArray(componentBlocks) ? componentBlocks : []

            if (newItems.length > 0) {
                renderItems(newItems, !resetList) // Append if not resetting
                currentPage = page
                renderLoadMore()
            } else {
                if (resetList) ul.innerHTML = "" // Clear previous results if new search is empty
                statusArea.innerHTML =
                    '<div style="padding:10px; color:#999; font-size:12px; text-align:center">No results found</div>'
            }
        } catch (err) {
            console.error(err)
            statusArea.innerHTML =
                '<div style="color:red; padding:10px; font-size:12px;">Error loading data</div>'
        } finally {
            isLoading = false
        }
    }

    // 5. Event Listeners

    // A. Focus: Open dropdown
    input.addEventListener("focus", showDropdown)

    // B. Blur: Hide dropdown (with delay handled in hideDropdown)
    input.addEventListener("blur", hideDropdown)

    // C. Input: Handle typing with Debounce
    const handleInput = debounce((e: Event) => {
        const val = (e.target as HTMLInputElement).value
        currentQuery = val
        currentPage = 1
        dropdown.style.display = "block" // Ensure dropdown is visible when typing
        fetchData(1, val, true) // Reset list = true
    }, 300) // 300ms delay

    input.addEventListener("input", handleInput)

    // 6. Assembly
    dropdown.appendChild(ul)
    dropdown.appendChild(statusArea)

    container.appendChild(input)
    container.appendChild(dropdown)
    rootElement.appendChild(container)
}