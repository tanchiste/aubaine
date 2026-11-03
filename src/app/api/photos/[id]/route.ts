import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { venuePhotos } from '@/db/schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response('Introuvable', { status: 404 });
  const [p] = await db.select({ mime: venuePhotos.mime, data: venuePhotos.data }).from(venuePhotos).where(eq(venuePhotos.id, id));
  if (!p) return new Response('Introuvable', { status: 404 });
  // Une photo ne change jamais (une nouvelle photo = un nouvel identifiant) : cache long.
  return new Response(new Uint8Array(p.data), {
    headers: {
      'Content-Type': p.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
