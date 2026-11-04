import { CATEGORIES } from '@/lib/categories';
import { brusselsDate, relativeDay, timeLabel } from '@/lib/format';
import { matchCategories } from '@/lib/search';
import { searchVenues } from '@/lib/venues';

/** Suggestions pendant la frappe : types d'activité et lieux qui correspondent */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 60);
  if (q.length < 2) return Response.json({ categories: [], venues: [] });
  const city = url.searchParams.get('ville') || undefined;
  const today = brusselsDate();
  const found = await searchVenues(q, { city: city === 'tout' ? undefined : city, limit: 6 });
  return Response.json({
    categories: matchCategories(q).map((c) => ({ key: c, label: CATEGORIES[c].label })),
    venues: found.map(({ venue, photoId, next, best }) => ({
      slug: venue.slug,
      name: venue.name,
      category: CATEGORIES[venue.category].short,
      city: venue.city,
      color: venue.color,
      photoId,
      best,
      next: next ? `${relativeDay(brusselsDate(next), today)} à ${timeLabel(next)}` : null,
    })),
  });
}
