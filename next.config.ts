import type { NextConfig } from "next";

const LANDING_URL = "https://tamowork-site.vercel.app";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Landing page → tamowork.com/ai
      { source: "/ai", destination: `${LANDING_URL}/` },
      { source: "/ai/:path*", destination: `${LANDING_URL}/:path*` },
    ];
  },
};

export default nextConfig;
