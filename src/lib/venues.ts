import 'server-only';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { offers, venuePhotos, venues, type Offer, type Venue, type VenueCategory } from '@/db/schema';
import { MAX_DISCOUNT, MIN_DISCOUNT, discounted } from './pricing';
import { addDays, brusselsHour } from './format';
import type { HourRange, Sort } from './params';
import { matchVenue } from './search';
import { distanceKm, hasPos, type LatLng } from './geo';

/** Ce qu'un créneau vend : la prestation (nom, durée, prix, groupe, capacité) */
export type OfferLite = Pick<Offer, 'id' | 'name' | 'durationMin' | 'groupMin' | 'groupMax' | 'capacityUnit' | 'priceCents' | 'priceUnit'>;
export type SlotView = { id: string; startsAt: Date; discountPct: number; capacity: number; remaining: number; offer: OfferLite };

/** Unités consommées par une réservation : une place par personne, ou une salle entière */
export const unitsFor = (o: Pick<Offer, 'capacityUnit'>, people: number) => (o.capacityUnit === 'places' ? people : 1);

/** Le groupe tient-il sur ce créneau (taille acceptée et assez de place) ? */
export const fits = (s: SlotView, people: number) =>
  people >= s.offer.groupMin && people <= s.offer.groupMax && s.remaining >= unitsFor(s.offer, people);

const REMAINING = sql`s.capacity - coalesce((
  select sum(case when o.capacity_unit = 'places' then b.people else 1 end)
  from bookings b where b.slot_id = s.id and (b.status in ('confirmed', 'checked_in') or (b.status = 'pending' and b.expires_at > now()))
), 0)`;

/** Colonnes communes : le créneau, sa prestation et les places restantes (alias s = slots, o = offers) */
const SLOT_COLS = sql`s.id, s.venue_id, s.starts_at, s.discount_pct, s.capacity,
  o.id as offer_id, o.name as offer_name, o.duration_min, o.group_min, o.group_max, o.capacity_unit, o.price_cents, o.price_unit,
  ${REMAINING} as remaining`;

const dayStart = (date: string) => sql`(${date}::date)::timestamp at time zone 'Europe/Brussels'`;
const dayEnd = (date: string) => sql`(${date}::date + 1)::timestamp at time zone 'Europe/Brussels'`;

type SlotRow = {
  id: string;
  venue_id: string;
  starts_at: Date;
  discount_pct: number;
  capacity: number;
  remaining: number;
  offer_id: string;
  offer_name: string;
  duration_min: number;
  group_min: number;
  group_max: number;
  capacity_unit: 'places' | 'groupes';
  price_cents: number;
  price_unit: 'person' | 'session';
};

function toSlot(r: SlotRow): SlotView {
  return {
    id: r.id,
    startsAt: new Date(r.starts_at),
    discountPct: r.discount_pct,
    capacity: r.capacity,
    remaining: Number(r.remaining),
    offer: {
      id: r.offer_id,
      name: r.offer_name,
      durationMin: r.duration_min,
      groupMin: r.group_min,
      groupMax: r.group_max,
      capacityUnit: r.capacity_unit,
      priceCents: r.price_cents,
      priceUnit: r.price_unit,
    },
  };
}

/** Créneaux à venir d'une journée (heure de Bruxelles), pour des établissements en ligne */
async function slotsForDay(date: string, venueIds?: string[]): Promise<SlotRow[]> {
  if (venueIds && venueIds.length === 0) return [];
  const rows = await db.execute<SlotRow>(sql`
    select ${SLOT_COLS}
    from slots s
    join venues v on v.id = s.venue_id
    join offers o on o.id = s.offer_id
    where v.status = 'published' and s.is_open and o.is_active
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
  const list = await db.select().from(venues).where(and(...conds));
  // Recherche en mémoire : sans accents, sur le nom, le type d'activité, la ville et la description.
  // La taille du groupe se vérifie créneau par créneau (chaque prestation a la sienne).
  return list.filter((v) => !f.q || matchVenue(v, f.q));
}

/** Établissements en ligne qui correspondent à une recherche, avec leur prochain créneau et leur meilleure remise sur 7 jours */
export async function searchVenues(q: string, opts: { people?: number; city?: string; limit?: number } = {}) {
  const list = (await db.select().from(venues).where(eq(venues.status, 'published')))
    .filter((v) => matchVenue(v, q))
    .filter((v) => !opts.city || v.city.toLowerCase() === opts.city.toLowerCase());
  if (list.length === 0) return [];
  const ids = list.map((v) => v.id);
  const [rows, photos] = await Promise.all([
    db.execute<{ venue_id: string; next: Date | null; best: number | null }>(sql`
      select v.id as venue_id,
        (select min(s.starts_at) from slots s where s.venue_id = v.id and s.is_open and s.starts_at > now()) as next,
        (select max(s.discount_pct) from slots s where s.venue_id = v.id and s.is_open and s.starts_at > now()
           and s.starts_at < now() + interval '7 days') as best
      from venues v where v.id in (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})`),
    firstPhotos(ids),
  ]);
  // Les lieux qui ont des créneaux à venir d'abord, puis les plus grosses remises.
  return list
    .map((v) => {
      const r = [...rows].find((x) => x.venue_id === v.id);
      return { venue: v, photoId: photos.get(v.id) ?? null, next: r?.next ? new Date(r.next) : null, best: r?.best ?? null };
    })
    .sort((a, b) => Number(!a.next) - Number(!b.next) || (b.best ?? 0) - (a.best ?? 0) || a.venue.name.localeCompare(b.venue.name, 'fr'))
    .slice(0, opts.limit ?? 20);
}

/** Prix le plus bas parmi des créneaux (par personne ou la séance, selon la prestation) */
export const minPrice = (slots: SlotView[]) => Math.min(...slots.map((s) => discounted(s.offer.priceCents, s.discountPct)));

export async function explorer(opts: Filters & { date: string; hours?: HourRange; sort?: Sort; from?: LatLng | null }) {
  const fit = await publishedVenues(opts);
  const [rows, photos] = await Promise.all([
    slotsForDay(
      opts.date,
      fit.map((v) => v.id),
    ),
    firstPhotos(fit.map((v) => v.id)),
  ]);
  const range = opts.hours ?? null;

  const byVenue = new Map<string, SlotView[]>();
  for (const r of rows) {
    const slot = toSlot(r);
    if (!fits(slot, opts.people)) continue;
    if (range) {
      const h = brusselsHour(new Date(r.starts_at));
      if (h < range.from || h >= range.to) continue;
    }
    const arr = byVenue.get(r.venue_id) ?? [];
    arr.push(slot);
    byVenue.set(r.venue_id, arr);
  }

  const items: ExplorerItem[] = fit
    .filter((v) => byVenue.has(v.id))
    .map((v) => ({ venue: v, photoId: photos.get(v.id) ?? null, slots: byVenue.get(v.id)! }));
  const sort = opts.sort ?? 'remise';
  const from = opts.from ?? null;
  const km = (v: Venue) => (from && hasPos(v) ? distanceKm(from, v) : Infinity);
  items.sort((a, b) => {
    if (sort === 'proche' && from) return km(a.venue) - km(b.venue);
    if (sort === 'heure') return a.slots[0].startsAt.getTime() - b.slots[0].startsAt.getTime();
    if (sort === 'prix') return minPrice(a.slots) - minPrice(b.slots);
    return Math.max(...b.slots.map((s) => s.discountPct)) - Math.max(...a.slots.map((s) => s.discountPct));
  });
  return items;
}

export type Deal = { venue: Venue; photoId: string | null; slot: SlotView };

/** Les plus grosses remises des 7 prochains jours : un créneau par lieu, le meilleur */
export async function bestDeals(f: Filters & { today: string; hours?: HourRange; limit?: number }): Promise<Deal[]> {
  const fit = await publishedVenues(f);
  if (fit.length === 0) return [];
  const rows = await db.execute<SlotRow>(sql`
    select ${SLOT_COLS}
    from slots s
    join offers o on o.id = s.offer_id
    where s.is_open and o.is_active and s.starts_at > now() + interval '30 minutes'
      and s.starts_at < ${dayEnd(addDays(f.today, 6))}
      ${f.hours ? sql`and extract(hour from s.starts_at at time zone 'Europe/Brussels') >= ${f.hours.from}
        and extract(hour from s.starts_at at time zone 'Europe/Brussels') < ${f.hours.to}` : sql``}
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
    const slot = toSlot(r);
    if (!fits(slot, f.people)) continue;
    out.push({ venue: v, photoId: photos.get(v.id) ?? null, slot });
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
    if (!fits(toSlot(r), people)) continue;
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

/** Créneaux à venir d'un établissement sur plusieurs jours d'affilée (une seule requête pour toute la bande de dates) */
export async function venueSlotsRange(venueId: string, from: string, days: number) {
  const rows = await db.execute<SlotRow>(sql`
    select ${SLOT_COLS}
    from slots s
    join venues v on v.id = s.venue_id
    join offers o on o.id = s.offer_id
    where v.status = 'published' and s.is_open and o.is_active
      and s.venue_id = ${venueId}::uuid
      and s.starts_at > now()
      and s.starts_at >= ${dayStart(from)} and s.starts_at < (${from}::date + ${days}::int)::timestamp at time zone 'Europe/Brussels'
    order by s.starts_at`);
  return [...rows].map(toSlot);
}

/* ---------- Checklist de validation ---------- */

export type CheckItem = { key: string; label: string; detail: string; state: 'ok' | 'ko' | 'info' };

export const MIN_PHOTOS = 3;

/** Prestations d'un ou plusieurs établissements, dans l'ordre choisi par l'exploitant */
export async function offersOf(venueIds: string[]): Promise<Map<string, Offer[]>> {
  const map = new Map<string, Offer[]>(venueIds.map((id) => [id, []]));
  if (venueIds.length === 0) return map;
  const rows = await db.select().from(offers).where(inArray(offers.venueId, venueIds)).orderBy(asc(offers.position), asc(offers.createdAt));
  for (const o of rows) map.get(o.venueId)?.push(o);
  return map;
}

export function checklist(v: Venue, photoCount: number, offerList: Offer[]): CheckItem[] {
  const missing: string[] = [];
  if (!v.description || v.description.trim().length < 40) missing.push('description (40 caractères minimum)');
  if (!v.address) missing.push('adresse');
  const ready = offerList.filter((o) => o.isActive && o.priceCents > 0 && o.durationMin > 0 && o.groupMin <= o.groupMax);

  return [
    {
      key: 'fiche',
      label: 'Fiche complète',
      state: missing.length ? 'ko' : 'ok',
      detail: missing.length ? `À compléter : ${missing.join(', ')}` : 'Description et adresse renseignées',
    },
    {
      key: 'prestations',
      label: ready.length ? `${ready.length} prestation${ready.length > 1 ? 's' : ''}` : 'Prestation',
      state: ready.length ? 'ok' : 'ko',
      detail: ready.length
        ? ready.map((o) => `${o.name} (${(o.priceCents / 100).toLocaleString('fr-BE')} € ${o.priceUnit === 'session' ? 'la séance' : 'par pers.'})`).join(', ')
        : 'Ajoute au moins une prestation avec son prix (ex. « Session 15 min, 22 € par pers. »)',
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
