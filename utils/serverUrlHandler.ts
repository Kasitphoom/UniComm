import { headers } from "next/headers";

const resolveBaseUrl = async (): Promise<string> => {
    // Always prefer the current origin in the browser to preserve domain and protocol (http/https)
    const headerList = await headers();
    const host = headerList.get("host");
    const protocol = headerList.get("x-forwarded-proto") || "http";
    if (host) {
        return `${protocol}://${host}`;
    }
    // Server-side fallback: use a sensible local default without relying on envs
    return "http://localhost:4100"
}

export const toAbsoluteUrl = async (endpoint: string): Promise<string> => {
    // If endpoint is already absolute, return as-is
    if (/^https?:\/\//i.test(endpoint)) return endpoint
    const base = await resolveBaseUrl()
    // Ensure leading slash for path
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
    return new URL(path, base).toString()
}