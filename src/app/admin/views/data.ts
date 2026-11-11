import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { addDays, brusselsDate } from '@/lib/format';
import type { DayPoint } from '../charts';

/** Réservations payées (confirmées ou honorées) par jour de réservation, sur les `n` derniers jours */
export async function bookingsByDay(n: number): Promise<DayPoint[]> {
  const today = brusselsDate();
  const from = addDays(today, -(n - 1));
  const rows = await db.execute<{ d: string; n: number; cents: number }>(sql`
    select to_char((created_at at time zone 'Europe/Brussels')::date, 'YYYY-MM-DD') as d,
      count(*)::int as n, coalesce(sum(total_cents), 0)::int as cents
    from bookings
    where status in ('confirmed', 'checked_in')
      and created_at >= (${from}::date)::timestamp at time zone 'Europe/Brussels'
    group by 1`);
  const byDay = new Map([...rows].map((r) => [r.d, r]));
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(from, i);
    const r = byDay.get(date);
    return { date, n: r?.n ?? 0, cents: r?.cents ?? 0 };
  });
}

/** Montant réservé cumulé par jour du mois (mois en cours jusqu'à aujourd'hui, ou mois précédent complet) */
export async function cumulativeMonth(which: 'current' | 'previous'): Promise<number[]> {
  const today = brusselsDate();
  const monthStart = today.slice(0, 8) + '01';
  const start = which === 'current' ? monthStart : addDays(monthStart, -1).slice(0, 8) + '01';
  const end = which === 'current' ? addDays(today, 1) : monthStart;
  const rows = await db.execute<{ d: number; cents: number }>(sql`
    select extract(day from (created_at at time zone 'Europe/Brussels'))::int as d, coalesce(sum(total_cents), 0)::int as cents
    from bookings
    where status in ('confirmed', 'checked_in')
      and created_at >= (${start}::date)::timestamp at time zone 'Europe/Brussels'
      and created_at < (${end}::date)::timestamp at time zone 'Europe/Brussels'
    group by 1`);
  const byDay = new Map([...rows].map((r) => [r.d, r.cents]));
  const length = which === 'current' ? Number(today.slice(8, 10)) : Number(addDays(monthStart, -1).slice(8, 10));
  let sum = 0;
  return Array.from({ length }, (_, i) => (sum += byDay.get(i + 1) ?? 0));
}
