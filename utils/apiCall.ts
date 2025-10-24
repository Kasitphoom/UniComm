const resolveBaseUrl = (): string => {
    // Always prefer the current origin in the browser to preserve domain and protocol (http/https)
    if (typeof window !== "undefined" && window.location?.origin) {
        return window.location.origin
    }
    // Server-side fallback: use a sensible local default without relying on envs
    return "http://localhost:4100"
}

export const toAbsoluteUrl = (endpoint: string): string => {
    // If endpoint is already absolute, return as-is
    if (/^https?:\/\//i.test(endpoint)) return endpoint
    const base = resolveBaseUrl()
    // Ensure leading slash for path
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
    return new URL(path, base).toString()
}

export const APICallHandler = async (endpoint: string, method: string, body?: any) => {
    const url = toAbsoluteUrl(endpoint)
    const isBodyAllowed = !/^(GET|HEAD)$/i.test(method)
    const response = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
        body: isBodyAllowed && body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        let errorMessage = 'API call failed'
        try {
            const errorData = await response.json()
            errorMessage = errorData.message || errorData.msg || errorMessage
        } catch {
            // ignore JSON parse error
        }
        throw new Error(errorMessage)
    }

    return response.json();
};

export default APICallHandler;