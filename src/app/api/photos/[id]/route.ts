import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { db } from '@/db';
import { venuePhotos } from '@/db/schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Largeurs servies : vignette, carte, carte sur grand écran, galerie */
const PHOTO_WIDTHS = [160, 480, 800, 1200] as const;

/** Petites versions déjà calculées, gardées tant que le serveur reste chaud */
const cache = new Map<string, Buffer>();
const CACHE_MAX = 120;

// Une photo ne change jamais (une nouvelle photo = un nouvel identifiant) : cache long, navigateur et CDN.
const HEADERS = {
  'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
};

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response('Introuvable', { status: 404 });
  const w = Number(new URL(req.url).searchParams.get('w'));
  const width = (PHOTO_WIDTHS as readonly number[]).includes(w) ? w : null;
  const key = `${id}:${width}`;

  if (width) {
    const hit = cache.get(key);
    if (hit) return new Response(new Uint8Array(hit), { headers: { 'Content-Type': 'image/webp', ...HEADERS } });
  }

  const [p] = await db.select({ mime: venuePhotos.mime, data: venuePhotos.data }).from(venuePhotos).where(eq(venuePhotos.id, id));
  if (!p) return new Response('Introuvable', { status: 404 });
  if (!width) return new Response(new Uint8Array(p.data), { headers: { 'Content-Type': p.mime, ...HEADERS } });

  try {
    const out = await sharp(p.data).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: width <= 160 ? 70 : 74 }).toBuffer();
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(key, out);
    return new Response(new Uint8Array(out), { headers: { 'Content-Type': 'image/webp', ...HEADERS } });
  } catch {
    // Format que sharp ne sait pas lire : on sert l'original.
    return new Response(new Uint8Array(p.data), { headers: { 'Content-Type': p.mime, ...HEADERS } });
  }
}
