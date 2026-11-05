import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export type VenueStats = {
  fillPct: number;
  netCents: number;
  grossCents: number;
  clients: number;
  bookings: number;
  avgBasketCents: number;
  noShowPct: number;
  upcomingSlots: number;
  upcomingFree: number;
};

/** Rendement d'un établissement : 30 derniers jours, et ce qui reste à remplir sur 7 jours */
export async function venueStats(venueId: string, commissionPct: number): Promise<VenueStats> {
  const [r] = [
    ...(await db.execute<{
      cap: number;
      used: number;
      gross: number;
      clients: number;
      n: number;
      noshow: number;
      up_slots: number;
      up_free: number;
    }>(sql`
    with past as (
      select s.id, s.capacity from slots s
      where s.venue_id = ${venueId} and s.starts_at < now() and s.starts_at > now() - interval '30 days'
    ),
    pb as (
      select b.*, case when o.capacity_unit = 'places' then b.people else 1 end as units
      from bookings b join slots s2 on s2.id = b.slot_id join offers o on o.id = s2.offer_id
      where b.venue_id = ${venueId} and b.slot_id in (select id from past) and b.status <> 'cancelled'
    ),
    up as (
      select s.capacity - coalesce((
        select sum(case when o.capacity_unit = 'places' then b.people else 1 end)
        from bookings b join offers o on o.id = s.offer_id
        where b.slot_id = s.id and b.status in ('confirmed', 'checked_in')), 0) as free
      from slots s
      where s.venue_id = ${venueId} and s.is_open and s.starts_at > now() and s.starts_at < now() + interval '7 days'
    )
    select
      coalesce((select sum(capacity) from past), 0)::int as cap,
      coalesce((select sum(units) from pb), 0)::int as used,
      coalesce((select sum(total_cents) from pb where status in ('confirmed', 'checked_in')), 0)::int as gross,
      (select count(distinct user_id) from pb)::int as clients,
      (select count(*) from pb)::int as n,
      (select count(*) from pb where status = 'no_show')::int as noshow,
      (select count(*) from up)::int as up_slots,
      coalesce((select sum(free) from up), 0)::int as up_free`)),
  ];
  const kept = r.n - r.noshow;
  return {
    fillPct: r.cap ? Math.round((r.used / r.cap) * 100) : 0,
    grossCents: r.gross,
    netCents: Math.round((r.gross * (100 - commissionPct)) / 100),
    clients: r.clients,
    bookings: r.n,
    avgBasketCents: kept ? Math.round(r.gross / kept) : 0,
    noShowPct: r.n ? Math.round((r.noshow / r.n) * 100) : 0,
    upcomingSlots: r.up_slots,
    upcomingFree: r.up_free,
  };
}
