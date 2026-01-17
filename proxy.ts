import { withAuth } from "next-auth/middleware"
import type { NextRequest } from "next/server"

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
                // For all other matched paths, require a valid session token
                return !!token
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
