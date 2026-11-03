import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Les photos sont envoyées via des Server Actions : on relève la limite par défaut (1 Mo).
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  poweredByHeader: false,
};

export default nextConfig;
