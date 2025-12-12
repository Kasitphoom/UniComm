'use client'
import { Input, InputProps } from '@heroui/react'
import { Search } from 'lucide-react'
import React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const SearchBar = ({ props }: { props?: InputProps }) => {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [value, setValue] = React.useState<string>(() => searchParams.get('query') ?? '')
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    const updateQueryParam = React.useCallback(
        (next: string) => {
            const params = new URLSearchParams(searchParams.toString())
            const trimmed = next.trim()

            if (trimmed) {
                params.set('query', trimmed)
            } else {
                params.delete('query')
            }

            const qs = params.toString()
            const url = qs ? `${pathname}?${qs}` : pathname
            router.replace(url)
        },
        [pathname, router, searchParams]
    )

    const handleValueChange = React.useCallback(
        (next: string) => {
            setValue(next)

            // propagate to any consumer callback passed in props
            props?.onValueChange?.(next)

            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            timeoutRef.current = setTimeout(() => updateQueryParam(next), 300)
        },
        [props, updateQueryParam]
    )

    // Clear pending timer on unmount
    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
    }, [])

    return (
        <Input
            {...props}
            value={value}
            onValueChange={handleValueChange}
            // If clear icon is clicked, ensure URL query is also cleared
            onClear={() => handleValueChange('')}
            placeholder="Search"
            classNames={{
                base: 'max-w-[300px]',
                inputWrapper: 'bg-white border-0',
            }}
            isClearable
            startContent={<Search size={16} className="text-default-500" />}
        />
    )
}

export default SearchBar