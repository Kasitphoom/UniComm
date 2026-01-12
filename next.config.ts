import type { NextConfig } from "next";
import path from "node:path";

// Prefer explicit NEXT_PUBLIC_APP_VERSION, fallback to npm package version
const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || process.env.npm_package_version || "0.0.0";

const pdfjsDistPath = path.dirname(require.resolve('pdfjs-dist/package.json'));

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["localhost:4100", "local.kasitphoom.com"],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

export default nextConfig;
