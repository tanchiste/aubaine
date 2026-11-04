import 'server-only';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { venuePhotos, venues, type Venue, type VenueCategory } from '@/db/schema';
import { MAX_DISCOUNT, MIN_DISCOUNT, discounted } from './pricing';
import { addDays, brusselsHour } from './format';
import { MOMENTS, type Moment, type Sort } from './params';

export type SlotView = { id: string; startsAt: Date; discountPct: number; capacity: number; remaining: number };

/** Unités consommées par une réservation : une place par personne, ou une salle entière */
export const unitsFor = (v: Pick<Venue, 'capacityUnit'>, people: number) => (v.capacityUnit === 'places' ? people : 1);

const REMAINING = sql`s.capacity - coalesce((
  select sum(case when v.capacity_unit = 'places' then b.people else 1 end)
  from bookings b where b.slot_id = s.id and b.status in ('confirmed', 'checked_in')
), 0)`;

const dayStart = (date: string) => sql`(${date}::date)::timestamp at time zone 'Europe/Brussels'`;
const dayEnd = (date: string) => sql`(${date}::date + 1)::timestamp at time zone 'Europe/Brussels'`;

type SlotRow = {
  id: string;
  venue_id: string;
  starts_at: Date;
  discount_pct: number;
  capacity: number;
  remaining: number;
};

function toSlot(r: SlotRow): SlotView {
  return {
    id: r.id,
    startsAt: new Date(r.starts_at),
    discountPct: r.discount_pct,
    capacity: r.capacity,
    remaining: Number(r.remaining),
  };
}

/** Créneaux à venir d'une journée (heure de Bruxelles), pour des établissements en ligne */
async function slotsForDay(date: string, venueIds?: string[]): Promise<SlotRow[]> {
  if (venueIds && venueIds.length === 0) return [];
  const rows = await db.execute<SlotRow>(sql`
    select s.id, s.venue_id, s.starts_at, s.discount_pct, s.capacity, ${REMAINING} as remaining
    from slots s
    join venues v on v.id = s.venue_id
    where v.status = 'published' and s.is_open
      and s.starts_at > now()
      and s.starts_at >= ${dayStart(date)} and s.starts_at < ${dayEnd(date)}
      ${venueIds ? sql`and s.venue_id in (${sql.join(venueIds.map((id) => sql`${id}::uuid`), sql`, `)})` : sql``}
    order by s.starts_at`);
  return [...rows];
}

/** Première photo de chaque établissement */
export async function firstPhotos(venueIds: string[]): Promise<Map<string, string>> {
  if (venueIds.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([venuePhotos.venueId], { venueId: venuePhotos.venueId, id: venuePhotos.id })
    .from(venuePhotos)
    .where(inArray(venuePhotos.venueId, venueIds))
    .orderBy(venuePhotos.venueId, asc(venuePhotos.position), asc(venuePhotos.createdAt));
  return new Map(rows.map((r) => [r.venueId, r.id]));
}

export async function photoList(venueId: string) {
  return db
    .select({ id: venuePhotos.id, position: venuePhotos.position, width: venuePhotos.width, height: venuePhotos.height })
    .from(venuePhotos)
    .where(eq(venuePhotos.venueId, venueId))
    .orderBy(asc(venuePhotos.position), asc(venuePhotos.createdAt));
}

export type ExplorerItem = { venue: Venue; photoId: string | null; slots: SlotView[] };
type Filters = { people: number; category?: VenueCategory; q?: string; city?: string };

/** Établissements en ligne qui correspondent aux filtres et acceptent ce nombre de personnes */
async function publishedVenues(f: Filters) {
  const conds = [eq(venues.status, 'published')];
  if (f.category) conds.push(eq(venues.category, f.category));
  if (f.city) conds.push(sql`lower(${venues.city}) = lower(${f.city})`);
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, (m) => '\\' + m)}%`;
    conds.push(sql`(${venues.name} ilike ${like} or ${venues.city} ilike ${like} or ${venues.area} ilike ${like})`);
  }
  const list = await db.select().from(venues).where(and(...conds));
  return list.filter((v) => f.people >= v.groupMin && f.people <= v.groupMax);
}

const minPrice = (v: Venue, slots: SlotView[]) => Math.min(...slots.map((s) => discounted(v.priceCents, s.discountPct)));

export async function explorer(opts: Filters & { date: string; moment?: Moment; sort?: Sort }) {
  const fit = await publishedVenues(opts);
  const [rows, photos] = await Promise.all([
    slotsForDay(
      opts.date,
      fit.map((v) => v.id),
    ),
    firstPhotos(fit.map((v) => v.id)),
  ]);
  const range = opts.moment ? MOMENTS[opts.moment] : null;

  const byVenue = new Map<string, SlotView[]>();
  for (const r of rows) {
    const v = fit.find((x) => x.id === r.venue_id)!;
    if (Number(r.remaining) < unitsFor(v, opts.people)) continue;
    if (range) {
      const h = brusselsHour(new Date(r.starts_at));
      if (h < range.from || h >= range.to) continue;
    }
    const arr = byVenue.get(r.venue_id) ?? [];
    arr.push(toSlot(r));
    byVenue.set(r.venue_id, arr);
  }

  const items: ExplorerItem[] = fit
    .filter((v) => byVenue.has(v.id))
    .map((v) => ({ venue: v, photoId: photos.get(v.id) ?? null, slots: byVenue.get(v.id)! }));
  const sort = opts.sort ?? 'remise';
  items.sort((a, b) => {
    if (sort === 'heure') return a.slots[0].startsAt.getTime() - b.slots[0].startsAt.getTime();
    if (sort === 'prix') return minPrice(a.venue, a.slots) - minPrice(b.venue, b.slots);
    return Math.max(...b.slots.map((s) => s.discountPct)) - Math.max(...a.slots.map((s) => s.discountPct));
  });
  return items;
}

export type Deal = { venue: Venue; photoId: string | null; slot: SlotView };

/** Les plus grosses remises des 7 prochains jours : un créneau par lieu, le meilleur */
export async function bestDeals(f: Filters & { today: string; limit?: number }): Promise<Deal[]> {
  const fit = await publishedVenues(f);
  if (fit.length === 0) return [];
  const rows = await db.execute<SlotRow>(sql`
    select s.id, s.venue_id, s.starts_at, s.discount_pct, s.capacity, ${REMAINING} as remaining
    from slots s
    join venues v on v.id = s.venue_id
    where s.is_open and s.starts_at > now() + interval '30 minutes'
      and s.starts_at < ${dayEnd(addDays(f.today, 6))}
      and s.venue_id in (${sql.join(
        fit.map((v) => sql`${v.id}::uuid`),
        sql`, `,
      )})
    order by s.discount_pct desc, s.starts_at asc`);
  const photos = await firstPhotos(fit.map((v) => v.id));
  const out: Deal[] = [];
  for (const r of rows) {
    if (out.some((d) => d.venue.id === r.venue_id)) continue;
    const v = fit.find((x) => x.id === r.venue_id)!;
    if (Number(r.remaining) < unitsFor(v, f.people)) continue;
    out.push({ venue: v, photoId: photos.get(v.id) ?? null, slot: toSlot(r) });
    if (out.length >= (f.limit ?? 8)) break;
  }
  return out;
}

/** Communes où au moins un établissement est en ligne */
export async function cities(): Promise<{ city: string; n: number }[]> {
  const rows = await db
    .select({ city: venues.city, n: sql<number>`count(*)::int` })
    .from(venues)
    .where(eq(venues.status, 'published'))
    .groupBy(venues.city)
    .orderBy(sql`count(*) desc`, venues.city);
  return rows;
}

/** Créneaux du jour qui démarrent dans les 3 prochaines heures */
export async function lastMinute(today: string, people: number, city?: string) {
  const rows = (await slotsForDay(today)).filter((r) => new Date(r.starts_at).getTime() - Date.now() < 3 * 3_600_000);
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => r.venue_id))];
  const [list, photos] = await Promise.all([
    db.select().from(venues).where(inArray(venues.id, ids)),
    firstPhotos(ids),
  ]);
  const out: { venue: Venue; photoId: string | null; slot: SlotView }[] = [];
  for (const r of rows) {
    const v = list.find((x) => x.id === r.venue_id)!;
    if (people < v.groupMin || people > v.groupMax || Number(r.remaining) < unitsFor(v, people)) continue;
    if (city && v.city.toLowerCase() !== city.toLowerCase()) continue;
    if (out.some((o) => o.venue.id === v.id)) continue;
    out.push({ venue: v, photoId: photos.get(v.id) ?? null, slot: toSlot(r) });
  }
  return out.sort((a, b) => b.slot.discountPct - a.slot.discountPct).slice(0, 6);
}

export async function venueBySlug(slug: string) {
  const [v] = await db.select().from(venues).where(eq(venues.slug, slug)).limit(1);
  return v ?? null;
}

export async function venueSlotsForDay(venueId: string, date: string) {
  return (await slotsForDay(date, [venueId])).map(toSlot);
}

/* ---------- Checklist de validation ---------- */

export type CheckItem = { key: string; label: string; detail: string; state: 'ok' | 'ko' | 'info' };

export const MIN_PHOTOS = 3;

export function checklist(v: Venue, photoCount: number): CheckItem[] {
  const missing: string[] = [];
  if (!v.description || v.description.trim().length < 40) missing.push('description (40 caractères minimum)');
  if (!v.address) missing.push('adresse');
  if (v.priceCents <= 0) missing.push('prix');
  if (v.durationMin <= 0) missing.push('durée');
  if (v.groupMin > v.groupMax) missing.push('taille de groupe');

  const unit = v.priceUnit === 'session' ? 'la séance' : 'par personne';
  return [
    {
      key: 'fiche',
      label: 'Fiche complète',
      state: missing.length ? 'ko' : 'ok',
      detail: missing.length
        ? `À compléter : ${missing.join(', ')}`
        : `${v.durationMin} min, ${v.groupMin} à ${v.groupMax} pers., ${(v.priceCents / 100).toLocaleString('fr-BE')} € ${unit}`,
    },
    {
      key: 'photos',
      label: `Photos : ${Math.min(photoCount, MIN_PHOTOS)} / ${MIN_PHOTOS}`,
      state: photoCount >= MIN_PHOTOS ? 'ok' : 'ko',
      detail:
        photoCount >= MIN_PHOTOS
          ? `${photoCount} photo${photoCount > 1 ? 's' : ''} ajoutée${photoCount > 1 ? 's' : ''}`
          : `Au moins ${MIN_PHOTOS} photos sont nécessaires pour la mise en ligne`,
    },
    {
      key: 'remise',
      label: `Remise de base −${v.baseDiscountPct} %`,
      state: v.baseDiscountPct >= MIN_DISCOUNT && v.baseDiscountPct <= MAX_DISCOUNT ? 'ok' : 'ko',
      detail: `Entre −${MIN_DISCOUNT} % et −${MAX_DISCOUNT} %`,
    },
    {
      key: 'paiements',
      label: 'Paiements',
      state: 'info',
      detail: 'Connexion du compte bancaire à venir (Stripe), non bloquant pour le moment',
    },
  ];
}

export const isReady = (items: CheckItem[]) => items.every((i) => i.state !== 'ko');
