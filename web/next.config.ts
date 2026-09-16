import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // There is a stray package-lock.json in the user's home directory, so
  // Turbopack inferred ~/ as the workspace root. Pin it to this app.
  turbopack: {
    root: __dirname,
  },
  // Prisma must stay outside the bundle so Cloudflare Workers load its WASM engine.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  // pg loads pg-cloudflare only on Workers, so Next's file tracing misses it.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/pg-cloudflare/**/*"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
};

export default nextConfig;

// Lets `next dev` read Cloudflare bindings (getCloudflareContext) from wrangler.jsonc.
initOpenNextCloudflareForDev();
