import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/** Les pages privées (comptes, espaces exploitant et admin) ne sont pas explorées */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/pro', '/admin', '/api/', '/billets', '/reserver', '/profil', '/connexion', '/inscription', '/signaler'] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
