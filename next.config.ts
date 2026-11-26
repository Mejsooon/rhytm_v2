import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Import CSV wysyła do 5 000 wierszy jedną akcją serwera (plik do 1 MB, po rozbiciu na wartości więcej)
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // Service worker powiadomień push: zawsze świeży (bez cache), żeby poprawki docierały od razu
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
