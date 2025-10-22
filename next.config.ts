import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Turbopack temporarily due to Node.js v24 compatibility issues
  // Can re-enable after upgrading to Node.js 22 LTS
  experimental: {
    turbo: undefined,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.shopify.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
