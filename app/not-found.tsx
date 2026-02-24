import Link from 'next/link'
import { Home, Search, RefreshCcw, ChevronRight } from 'lucide-react'

const Error404Page = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-background">
            {/* Minimalist Visual Header */}
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
                Error Code 404
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-default-900 sm:text-5xl">
                Page not found
            </h1>
            
            {/* Informative Diagnostics */}
            <p className="mt-6 max-w-md text-center text-default-500">
                The content you are looking for has been moved or no longer exists. 
                Before headed back, you might want to:
            </p>

            <ul className="mt-8 w-full max-w-sm space-y-2">
                <li className="flex items-center gap-3 rounded-xl border border-default-100 bg-content1/50 p-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-default-100 text-default-500">
                        <Search size={16} />
                    </div>
                    <span className="text-sm text-default-600">Check the URL for spelling errors</span>
                </li>
                <li className="flex items-center gap-3 rounded-xl border border-default-100 bg-content1/50 p-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-default-100 text-default-500">
                        <RefreshCcw size={16} />
                    </div>
                    <span className="text-sm text-default-600">Try refreshing the browser</span>
                </li>
            </ul>

            {/* Primary Action */}
            <div className="mt-12">
                <Link
                    href="/"
                    className="group flex items-center gap-3 rounded-full bg-secondary px-8 py-4 text-sm font-bold text-white shadow-xl shadow-secondary/20 transition-all hover:bg-secondary-600 hover:shadow-secondary/30"
                >
                    <Home size={18} />
                    Return to Home
                    <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
                </Link>
            </div>

            {/* Subtle Footer */}
            <p className="mt-12 text-tiny text-default-400">
                If you believe this is a technical error, please contact your administrator.
            </p>
        </div>
    )
}

export default Error404Page