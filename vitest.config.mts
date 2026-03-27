import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "happy-dom",
        globals: true,
        setupFiles: ["./tests/setup.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "lcov"],
            exclude: [
                "node_modules/**",
                ".next/**",
                "tests/**",
                "**/*.config.*",
                "prisma/**",
                "scripts/**",
                "public/**",
            ],
        },
        include: ["tests/**/*.{test,spec}.{ts,tsx}"],
        exclude: ["tests/e2e/**"],
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "."),
        },
    },
});
