import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@depano/schemas'],
  poweredByHeader: false,
  images: { unoptimized: true },
};

export default nextConfig;
