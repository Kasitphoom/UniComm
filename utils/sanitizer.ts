export function escapeRegex(input: string) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function sanitizeQuery(raw: string | undefined | null): string | undefined {
    if (!raw) return undefined
    const trimmed = raw.trim()
    if (!trimmed) return undefined
    const collapsed = trimmed.replace(/\s+/g, ' ')
    const capped = collapsed.slice(0, 200)
    return escapeRegex(capped)
}