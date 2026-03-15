import { withAuth } from "next-auth/middleware"
import type { NextRequest } from "next/server"
import { DEFAULT_BUSINESS_COOKIE } from "@/types/business"

export default withAuth(
    function middleware(_req: NextRequest) {
        // add per-request logic here if needed
    },
    {
        callbacks: {
            authorized: ({ token, req }) => {
                const { pathname } = req.nextUrl
                // Allow the public root page
                if (pathname === "/" || pathname === "/forgot-password") return true
                // Allow invite flow without requiring selected business cookie
                if (pathname.startsWith('/business/invite')) return !!token

                const defaultBusiness = req.cookies.get(DEFAULT_BUSINESS_COOKIE)?.value
                // For all other matched paths, require a valid session token
                return !!token && !!defaultBusiness
            },
        },
        pages: {
            signIn: "/", // send unauthenticated users to the root login page
        },
    }
)

// Only run the middleware on non-API, non-static asset routes.
export const config = {
    matcher: [
        // Skip Next.js internals and all API routes
        "/((?!api|_next/static|_next/image|favicon.ico|images|public).*)",
    ],
}
