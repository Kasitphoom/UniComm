export const timeDifferenceFormatter = (date: Date): string => {
    const now = new Date()
    const diffInMs = date.getTime() - now.getTime()
    const isFuture = diffInMs > 0
    const absDiffInMinutes = Math.floor(Math.abs(diffInMs) / (1000 * 60))

    const format = (value: number, unit: string) =>
        isFuture ? `in ${value}${unit}` : `${value}${unit} ago`

    if (absDiffInMinutes < 1) {
        return isFuture ? 'in <1min' : 'just now'
    }
    if (absDiffInMinutes < 60) {
        return format(absDiffInMinutes, 'min')
    }

    const absDiffInHours = Math.floor(absDiffInMinutes / 60)
    if (absDiffInHours < 24) {
        return format(absDiffInHours, 'h')
    }

    const absDiffInDays = Math.floor(absDiffInHours / 24)
    if (absDiffInDays < 7) {
        return format(absDiffInDays, 'd')
    }

    const absDiffInWeeks = Math.floor(absDiffInDays / 7)
    if (absDiffInWeeks < 4) {
        return format(absDiffInWeeks, 'w')
    }

    const absDiffInMonths = Math.floor(absDiffInDays / 30)
    if (absDiffInMonths < 12) {
        return format(absDiffInMonths, ' month(s)')
    }

    const absDiffInYears = Math.floor(absDiffInDays / 365)
    return format(absDiffInYears, ' year(s)')
}