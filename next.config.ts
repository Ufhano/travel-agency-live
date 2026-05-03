import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* pdf-parse/pdfjs-dist use a worker file; bundling (esp. Turbopack) breaks the fake-worker path */
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;
