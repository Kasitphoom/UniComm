const resolveBaseUrl = (): string => {
    // 1) Allow explicit override if provided
    const explicit = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL
    if (explicit) return explicit.replace(/\/$/, "")

    // 2) Pick domain by environment
    const stage = (process.env.NEXT_PUBLIC_STAGE || process.env.VERCEL_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'development')).toLowerCase()

    let domain: string | undefined
    if (stage === 'production' || stage === 'prod') {
        domain = process.env.PROD_BASE_DOMAIN
    } else if (stage === 'preview' || stage === 'staging' || stage === 'stage' || stage === 'stg') {
        domain = process.env.STG_BASE_DOMAIN
    } else {
        domain = process.env.DEV_BASE_DOMAIN
    }

    if (domain) {
        // Only "localhost" should have a port; all other env domains are portless
        const isLocalhost = /^localhost$/i.test(domain)
        const protocol = isLocalhost ? 'http' : 'https'
        const hasPort = /:\d+$/.test(domain)
        const withPort = (!hasPort && isLocalhost) ? `${domain}:4100` : domain
        return `${protocol}://${withPort}`
    }

    // 3) Fallback to browser origin when available
    if (typeof window !== "undefined" && window.location?.origin) return window.location.origin

    // 4) Final fallback for SSR/local dev (matches package.json dev port)
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