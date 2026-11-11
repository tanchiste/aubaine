import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { addDays, brusselsDate, euros } from '@/lib/format';
import { CumulativeLines } from '../charts';
import { cumulativeMonth } from './data';

const monthName = (d: string) => new Intl.DateTimeFormat('fr-BE', { month: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));

/** Montant réservé via Aubaine ce mois : cumul jour après jour comparé au mois précédent, et détail par lieu */
export async function RevenueView() {
  const today = brusselsDate();
  const monthStart = today.slice(0, 8) + '01';
  const prevStart = addDays(monthStart, -1).slice(0, 8) + '01';
  const [current, previous, byVenue] = await Promise.all([
    cumulativeMonth('current'),
    cumulativeMonth('previous'),
    db.execute<{ id: string; name: string; slug: string; n: number; cents: number; fee: number }>(sql`
      select v.id, v.name, v.slug, count(*)::int as n, coalesce(sum(b.total_cents), 0)::int as cents, coalesce(sum(b.fee_cents), 0)::int as fee
      from bookings b join venues v on v.id = b.venue_id
      where b.status in ('confirmed', 'checked_in')
        and b.created_at >= (${monthStart}::date)::timestamp at time zone 'Europe/Brussels'
      group by v.id, v.name, v.slug
      order by cents desc`),
  ]);
  const rows = [...byVenue];
  const total = current.at(-1) ?? 0;
  const fee = rows.reduce((s, r) => s + r.fee, 0);
  const sameDayPrev = previous[Math.min(current.length, previous.length) - 1] ?? 0;
  const cur = monthName(monthStart);
  const prev = monthName(prevStart);
  const diff = sameDayPrev ? Math.round(((total - sameDayPrev) / sameDayPrev) * 100) : null;
  const title = `${euros(total)} réservés en ${cur}${diff !== null ? `, ${diff >= 0 ? '+' : '−'}${Math.abs(diff)} % par rapport à ${prev} à la même date` : ''}`;
  const top = rows[0]?.cents ?? 0;

  return (
    <>
      <section className="card stack" aria-labelledby="r-chart" style={{ padding: '20px 22px', ['--gap' as string]: '10px' }}>
        <div className="stack" style={{ ['--gap' as string]: '2px' }}>
          <h2 id="r-chart" style={{ fontSize: 17, fontWeight: 800 }}>{title}</h2>
          <p className="small muted">Montant payé par les clients, cumulé jour après jour. Commission d’Aubaine ce mois : {euros(fee)}.</p>
        </div>
        <div className="chart-legend" aria-hidden="true">
          <span><i style={{ background: '#3A28D4' }} /> {cur}</span>
          <span><i className="dashed" /> {prev}</span>
        </div>
        <div className="chart-wrap"><CumulativeLines current={current} previous={previous} monthLabel={cur} prevLabel={prev} title={title} /></div>
      </section>

      <section className="card stack" aria-labelledby="r-venues" style={{ padding: '18px 22px', ['--gap' as string]: '12px' }}>
        <h2 id="r-venues" style={{ fontSize: 16, fontWeight: 800 }}>Par établissement, en {cur}</h2>
        {rows.length === 0 ? (
          <p className="small muted">Aucune réservation payée ce mois-ci.</p>
        ) : (
          <ul className="hbars">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/lieu/${r.slug}`} className="hbar-name">{r.name}</Link>
                <span className="hbar-track" title={`${r.name} : ${euros(r.cents)}, ${r.n} réservation${r.n > 1 ? 's' : ''}, commission ${euros(r.fee)}`}>
                  <span className="hbar-fill" style={{ width: `${Math.max(2, (r.cents / top) * 100)}%` }} />
                </span>
                <span className="hbar-value">
                  <b>{euros(r.cents)}</b>
                  <span className="small muted">{r.n} rés. · {euros(r.fee)} de commission</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
