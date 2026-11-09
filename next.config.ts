import type { NextConfig } from 'next';

/** En-têtes de sécurité sur toutes les réponses */
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Aubaine ne s'affiche jamais dans le cadre d'un autre site (contre le détournement de clics).
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  // La position ne sert qu'à « Autour de moi », sur Aubaine même ; ni caméra ni micro.
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), browsing-topics=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  // Les photos sont envoyées via des Server Actions : on relève la limite par défaut (1 Mo).
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
