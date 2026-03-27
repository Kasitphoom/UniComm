import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [["list"], ["html", { open: "never" }]],
    use: {
        baseURL: "http://localhost:4100",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
    },
    webServer: {
        command: "E2E_BYPASS_AUTH=true NEXTAUTH_SECRET=e2e-secret AUTH_SECRET=e2e-secret NEXTAUTH_URL=http://localhost:4100 npm run dev",
        url: "http://localhost:4100",
        reuseExistingServer: !process.env.CI,
        timeout: 180000,
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
})
