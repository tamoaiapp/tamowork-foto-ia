import type { NextConfig } from "next";

const LANDING_URL = "https://tamowork-site.vercel.app";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Onboarding removido — redireciona direto para o app
      { source: "/onboarding", destination: "/", permanent: false },
    ];
  },
  async rewrites() {
    return [
      // Landing page → tamowork.com/ai
      { source: "/ai", destination: `${LANDING_URL}/` },
      { source: "/ai/:path*", destination: `${LANDING_URL}/:path*` },
    ];
  },
  webpack(config) {
    // Permite carregar arquivos .wasm no browser (necessário para @imgly/background-removal)
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

export default nextConfig;
