import type { NextConfig } from "next";

const LANDING_URL = "https://tamowork-site.vercel.app";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/onboarding", destination: "/", permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: "/ai", destination: `${LANDING_URL}/` },
      { source: "/ai/:path*", destination: `${LANDING_URL}/:path*` },
    ];
  },
  async headers() {
    return [
      {
        // Service worker deve ter escopo raiz e não ser cacheado pelo browser
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript" },
        ],
      },
      {
        // Manifest — revalidado a cada visita
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
      {
        // Badge SVG servido como imagem
        source: "/icons/badge-96.svg",
        headers: [
          { key: "Content-Type", value: "image/svg+xml" },
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
