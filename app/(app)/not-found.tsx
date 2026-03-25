import Link from "next/link"

const NotFoundPage = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
            {/* Minimalist graphic element - a simple circle with an exclamation */}
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-default-50 text-default-400">
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            </div>

            <h1 className="text-lg font-medium text-default-900 tracking-tight">
                Content not found
            </h1>

            <p className="mt-2 max-w-70 text-sm text-default-400 leading-relaxed">
                The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>

            <Link
                href="/dashboard"
                className="mt-8 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-secondary-600 transition-colors"
            >
                Back to Dashboard
            </Link>
        </div>
    )
}

export default NotFoundPage
