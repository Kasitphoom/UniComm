import type { NextConfig } from "next";

// Prefer explicit NEXT_PUBLIC_APP_VERSION, fallback to npm package version
const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || process.env.npm_package_version || "0.0.0";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["localhost:4100", "local.kasitphoom.com"],
  outputFileTracingExcludes: {
    "/*": ["./docs/**/*"],
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

export default nextConfig;
