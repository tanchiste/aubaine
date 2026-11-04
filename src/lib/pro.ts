import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users, venueEvents, venueMembers, venues, type VenueCategory } from '@/db/schema';
import { getMyVenues, requireUser } from './auth';
import { VENUE_COLORS } from './categories';

export const VENUE_COOKIE = 'aub_venue';

/** Utilisateur connecté, ses établissements et celui qu'il est en train de gérer */
export async function getProContext(next = '/pro') {
  const user = await requireUser(next);
  const mine = await getMyVenues(user.id);
  const selected = (await cookies()).get(VENUE_COOKIE)?.value;
  const current = mine.find((m) => m.venue.id === selected) ?? mine[0] ?? null;
  return { user, mine, current, role: current?.role ?? null };
}

/** Pages réservées au gérant : l'équipe d'accueil est renvoyée vers l'accueil */
export async function requireOwnerContext(next: string) {
  const ctx = await getProContext(next);
  if (ctx.current && ctx.role !== 'owner' && !ctx.user.isAdmin) redirect('/pro');
  return ctx;
}

export function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/&/g, ' et ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'lieu'
  );
}

/** Réglages de départ selon le type d'activité, modifiables ensuite */
export const DEFAULTS: Record<VenueCategory, { durationMin: number; groupMin: number; groupMax: number; capacity: number; capacityUnit: 'places' | 'groupes'; priceUnit: 'person' | 'session' }> = {
  escape: { durationMin: 60, groupMin: 2, groupMax: 6, capacity: 1, capacityUnit: 'groupes', priceUnit: 'person' },
  karting: { durationMin: 15, groupMin: 1, groupMax: 12, capacity: 8, capacityUnit: 'places', priceUnit: 'person' },
  laser: { durationMin: 20, groupMin: 4, groupMax: 20, capacity: 20, capacityUnit: 'places', priceUnit: 'person' },
  vr: { durationMin: 30, groupMin: 1, groupMax: 8, capacity: 8, capacityUnit: 'places', priceUnit: 'person' },
  bowling: { durationMin: 45, groupMin: 1, groupMax: 6, capacity: 4, capacityUnit: 'groupes', priceUnit: 'person' },
  hache: { durationMin: 60, groupMin: 2, groupMax: 8, capacity: 2, capacityUnit: 'groupes', priceUnit: 'person' },
  bienetre: { durationMin: 120, groupMin: 1, groupMax: 2, capacity: 1, capacityUnit: 'groupes', priceUnit: 'session' },
  autre: { durationMin: 60, groupMin: 1, groupMax: 10, capacity: 10, capacityUnit: 'places', priceUnit: 'person' },
};


/** Crée une fiche en brouillon dont l'utilisateur devient gérant */
export async function createDraftVenue(userId: string, v: { name: string; category: VenueCategory; city: string }): Promise<string> {
  let slug = slugify(v.name);
  const taken = await db.select({ slug: venues.slug }).from(venues).where(sql`${venues.slug} like ${slug + '%'}`);
  if (taken.some((t) => t.slug === slug)) {
    let i = 2;
    while (taken.some((t) => t.slug === `${slug}-${i}`)) i++;
    slug = `${slug}-${i}`;
  }
  const color = VENUE_COLORS[Math.floor(Math.random() * VENUE_COLORS.length)];
  const [row] = await db
    .insert(venues)
    .values({ slug, name: v.name, category: v.category, city: v.city, color, ...DEFAULTS[v.category], priceCents: 0, baseDiscountPct: 25 })
    .returning({ id: venues.id });
  await db.insert(venueMembers).values({ venueId: row.id, userId, role: 'owner' });
  await db.insert(venueEvents).values({ venueId: row.id, actorId: userId, action: 'created' });
  await db.update(users).set({ kind: 'exploitant' }).where(eq(users.id, userId));
  return row.id;
}
