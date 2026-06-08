import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/nendila-logo.png",
        permanent: true,
      },
    ];
  },
  /* pdf-parse/pdfjs-dist use a worker file; bundling (esp. Turbopack) breaks the fake-worker path */
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "@napi-rs/canvas",
    "tesseract.js",
  ],
};

export default nextConfig;
