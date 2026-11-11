import type { MetadataRoute } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { venues } from '@/db/schema';
import { siteUrl } from '@/lib/site';

// Recalculé toutes les heures : une fiche validée y apparaît sans redéploiement.
export const revalidate = 3600;

/** Accueil, fiches en ligne et pages d'information */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const list = await db.select({ slug: venues.slug, updatedAt: venues.updatedAt }).from(venues).where(eq(venues.status, 'published'));
  const pages = ['/aide', '/conditions', '/conditions-partenaires', '/confidentialite', '/cookies', '/mentions-legales'];
  return [
    { url: `${base}/`, changeFrequency: 'hourly', priority: 1 },
    ...list.map((v) => ({ url: `${base}/lieu/${v.slug}`, lastModified: v.updatedAt, changeFrequency: 'daily' as const, priority: 0.8 })),
    ...pages.map((p) => ({ url: `${base}${p}`, changeFrequency: 'monthly' as const, priority: 0.3 })),
  ];
}
