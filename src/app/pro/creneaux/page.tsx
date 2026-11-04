import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { Deal } from '@/components/ui';
import { addDays, brusselsDate, dayChip, isDateStr, longDate, capitalize, timeLabel } from '@/lib/format';
import { requireOwnerContext } from '@/lib/pro';
import { deleteSlotAction, toggleSlotAction } from './actions';
import { SlotForm } from './SlotForm';

export const metadata = { title: 'Créneaux' };

type Row = { id: string; starts_at: Date; capacity: number; discount_pct: number; is_open: boolean; used: number; n: number };

export default async function SlotsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { current } = await requireOwnerContext('/pro/creneaux');
  if (!current) redirect('/pro');
  const v = current.venue;
  const today = brusselsDate();
  const sp = await searchParams;
  const date = isDateStr(sp.date) && sp.date >= today ? sp.date : today;
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  const rows = [
    ...(await db.execute<Row>(sql`
      select s.id, s.starts_at, s.capacity, s.discount_pct, s.is_open,
        coalesce(sum(case when b.status in ('confirmed','checked_in') then (case when ${v.capacityUnit} = 'places' then b.people else 1 end) end), 0)::int as used,
        count(b.id) filter (where b.status in ('confirmed','checked_in'))::int as n
      from slots s left join bookings b on b.slot_id = s.id
      where s.venue_id = ${v.id}
        and s.starts_at >= (${date}::date)::timestamp at time zone 'Europe/Brussels'
        and s.starts_at < (${date}::date + 1)::timestamp at time zone 'Europe/Brussels'
      group by s.id order by s.starts_at`)),
  ];
  const open = rows.filter((r) => r.is_open);
  const cap = open.reduce((s, r) => s + r.capacity, 0);
  const used = open.reduce((s, r) => s + r.used, 0);
  const unit = v.capacityUnit === 'places' ? 'places' : 'salles';

  return (
    <>
      <header className="stack" style={{ ['--gap' as string]: '4px' }}>
        <h1 className="display" style={{ fontSize: 22 }}>Créneaux creux</h1>
        <p className="small muted">{capitalize(longDate(date))} · {open.length} en ligne{cap ? ` · ${Math.round((used / cap) * 100)} % remplis` : ''}</p>
      </header>
      {v.status !== 'published' && <p className="notice notice-amber small">Ta fiche n’est pas encore en ligne : tes créneaux seront visibles dès sa validation.</p>}

      <nav className="days" aria-label="Choisir le jour">
        {days.map((d) => {
          const c = dayChip(d, today);
          return (
            <Link key={d} className="day" href={d === today ? '/pro/creneaux' : `/pro/creneaux?date=${d}`} aria-current={d === date ? 'true' : undefined}>
              <span>{c.top}</span>
              <b>{c.num}</b>
            </Link>
          );
        })}
      </nav>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', alignItems: 'start' }}>
        <section className="stack" aria-label="Créneaux du jour" style={{ ['--gap' as string]: '8px' }}>
          {rows.length === 0 && <p className="card muted small">Aucun créneau ce jour-là. Ouvre-en un avec le formulaire.</p>}
          {rows.map((r) => {
            const start = new Date(r.starts_at);
            const past = start.getTime() < Date.now();
            const pct = r.capacity ? Math.min(100, Math.round((r.used / r.capacity) * 100)) : 0;
            const full = r.used >= r.capacity;
            return (
              <div key={r.id} className="card stack" style={{ padding: '12px 14px', ['--gap' as string]: '8px', opacity: r.is_open && !past ? 1 : 0.55 }}>
                <div className="row">
                  <b style={{ fontSize: 16, width: 50 }}>{timeLabel(start)}</b>
                  <Deal pct={r.discount_pct} small />
                  {!r.is_open && <span className="pill pill-muted">fermé</span>}
                  {past && <span className="pill pill-muted">passé</span>}
                  <span className="grow" />
                  {!past && (
                    <form action={toggleSlotAction}>
                      <input type="hidden" name="slotId" value={r.id} />
                      <button className="btn btn-sm">{r.is_open ? 'Fermer' : 'Rouvrir'}</button>
                    </form>
                  )}
                  {!past && r.n === 0 && (
                    <form action={deleteSlotAction}>
                      <input type="hidden" name="slotId" value={r.id} />
                      <button className="btn btn-sm btn-danger" aria-label={`Supprimer le créneau de ${timeLabel(start)}`}>Supprimer</button>
                    </form>
                  )}
                </div>
                <div className="row">
                  <div aria-hidden="true" className="grow" style={{ height: 6, borderRadius: 3, background: 'var(--line-2)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: full ? '#1E9E6A' : 'var(--primary)' }} />
                  </div>
                  <span className="small tnum" style={{ fontWeight: 700, color: full ? 'var(--ok)' : 'var(--ink-2)', minWidth: 74, textAlign: 'right' }}>
                    {r.used}/{r.capacity} {full ? 'plein' : unit}
                  </span>
                </div>
              </div>
            );
          })}
        </section>
        <SlotForm venueId={v.id} date={date} capacity={v.capacity} discount={v.baseDiscountPct} unit={v.capacityUnit} />
      </div>
    </>
  );
}
