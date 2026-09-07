import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // There is a stray package-lock.json in the user's home directory, so
  // Turbopack inferred ~/ as the workspace root. Pin it to this app.
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
};

export default nextConfig;
