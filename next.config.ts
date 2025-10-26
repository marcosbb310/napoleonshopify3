import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Set the correct workspace root to prevent Next.js warnings
  outputFileTracingRoot: __dirname,
  // Disable Turbopack temporarily due to Node.js v24 compatibility issues
  // Can re-enable after upgrading to Node.js 22 LTS
  experimental: {
    turbo: undefined,
  },
  // ESLint and TypeScript checks are now enabled for better code quality
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
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
