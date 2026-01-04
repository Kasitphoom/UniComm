import type { NextConfig } from "next";
import path from "node:path";
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { Copy } from "lucide-react";

// Prefer explicit NEXT_PUBLIC_APP_VERSION, fallback to npm package version
const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || process.env.npm_package_version || "0.0.0";

const pdfjsDistPath = path.dirname(require.resolve('pdfjs-dist/package.json'));
const cMapsDir = path.join(pdfjsDistPath, 'cmaps');
const wasmDir = path.join(pdfjsDistPath, 'wasm');
const standardFontsDir = path.join(pdfjsDistPath, 'standard_fonts');

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["localhost:4100", "local.kasitphoom.com"],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  webpack: (config) => {
    config.plugins = [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: cMapsDir,
            to: "cmaps/",
          },
        ],
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: wasmDir,
            to: "wasm/",
          },
        ],
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: standardFontsDir,
            to: "standard_fonts/",
          }
        ],
      }),
      ...(config.plugins || []),
    ]

    return config;
  },
};

export default nextConfig;
