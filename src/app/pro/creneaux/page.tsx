import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, users } from '@/db/schema';
import { IconBack, IconChevronRight, IconPlus } from '@/components/icons';
import { addDays, brusselsDate, capitalize, euros, isDateStr, longDate, timeLabel } from '@/lib/format';
import { discounted } from '@/lib/pricing';
import { requireOwnerContext } from '@/lib/pro';
import { offersOf } from '@/lib/venues';
import { EditSlotForm, NewSlotForm, type EditorOffer } from './SlotEditor';

export const metadata = { title: 'Créneaux' };

type Row = {
  id: string;
  offer_id: string;
  starts_at: Date;
  capacity: number;
  discount_pct: number;
  is_open: boolean;
  used: number;
  nbook: number;
};

/** Une couleur par prestation, pour les distinguer d'un coup d'œil dans le planning */
const OFFER_COLORS = ['#3A28D4', '#E89A00', '#1E7F57', '#CF3520', '#2B8C9E', '#5B2A86', '#8C3B2A', '#1F6F8B'];

/** Lundi de la semaine qui contient cette date */
const mondayOf = (d: string) => addDays(d, -((new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7));
const dayHead = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
const rangeFmt = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', timeZone: 'UTC' });

export default async function SlotsPage({ searchParams }: { searchParams: Promise<{ semaine?: string; date?: string; creneau?: string }> }) {
  const sp = await searchParams;
  const { current, role } = await requireOwnerContext('/pro/creneaux');
  if (!current) redirect('/pro');
  const venue = current.venue;
  const today = brusselsDate();
  const focus = isDateStr(sp.date) ? sp.date : isDateStr(sp.semaine) ? sp.semaine : today;
  const week = mondayOf(focus);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  const [offerMap, rows] = await Promise.all([
    offersOf([venue.id]),
    db.execute<Row>(sql`
      select s.id, s.offer_id, s.starts_at, s.capacity, s.discount_pct, s.is_open,
        coalesce(sum(case when o.capacity_unit = 'places' then b.people else 1 end) filter (where b.status in ('confirmed', 'checked_in')), 0)::int as used,
        (count(b.id) filter (where b.status in ('confirmed', 'checked_in')))::int as nbook
      from slots s
      join offers o on o.id = s.offer_id
      left join bookings b on b.slot_id = s.id
      where s.venue_id = ${venue.id}
        and s.starts_at >= (${week}::date)::timestamp at time zone 'Europe/Brussels'
        and s.starts_at < (${week}::date + 7)::timestamp at time zone 'Europe/Brussels'
      group by s.id
      order by s.starts_at`),
  ]);
  const allOffers = offerMap.get(venue.id) ?? [];
  const toEditor = (o: (typeof allOffers)[number], i: number): EditorOffer => ({
    id: o.id,
    name: o.name,
    priceCents: o.priceCents,
    priceUnit: o.priceUnit,
    capacity: o.capacity,
    capacityUnit: o.capacityUnit,
    color: OFFER_COLORS[i % OFFER_COLORS.length],
  });
  const editorOffers = allOffers.map(toEditor);
  const active = editorOffers.filter((_, i) => allOffers[i].isActive);
  const offerById = new Map(editorOffers.map((o) => [o.id, o]));
  const list = [...rows].map((r) => ({ ...r, startsAt: new Date(r.starts_at), day: brusselsDate(new Date(r.starts_at)) }));
  const many = active.length > 1;
  const now = Date.now();

  const editing = sp.creneau ? list.find((r) => r.id === sp.creneau) : undefined;
  const slotBookings = editing
    ? await db
        .select({ id: bookings.id, firstName: users.firstName, people: bookings.people, code: bookings.code, status: bookings.status })
        .from(bookings)
        .innerJoin(users, eq(users.id, bookings.userId))
        .where(and(eq(bookings.slotId, editing.id), inArray(bookings.status, ['confirmed', 'checked_in', 'cancelled', 'no_show'])))
        .orderBy(bookings.createdAt)
    : [];
  // Le panneau latéral ne s'ouvre que pour créer ou modifier : le reste du temps, la semaine prend toute la place.
  const panel = editing ? 'edit' : sp.date || active.length === 0 ? 'new' : null;
  const base = (extra: Record<string, string>) => `/pro/creneaux?${new URLSearchParams({ semaine: week, ...extra }).toString()}`;
  const total = list.filter((r) => r.is_open && r.startsAt.getTime() > now).length;
  const filled = list.reduce((s, r) => s + r.used, 0);
  const cap = list.reduce((s, r) => s + r.capacity, 0);

  return (
    <>
      <header className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 10 }}>
        <div className="stack" style={{ ['--gap' as string]: '4px' }}>
          <h1 className="display" style={{ fontSize: 22 }}>Créneaux</h1>
          <span className="small muted">
            {total} créneau{total > 1 ? 'x' : ''} à venir cette semaine · {cap ? Math.round((filled / cap) * 100) : 0} % rempli
          </span>
        </div>
        <div className="slots-actions">
        <nav className="week-nav" aria-label="Changer de semaine">
          <Link prefetch={false} className="icon-btn" href={base({ semaine: addDays(week, -7) })} aria-label="Semaine précédente"><IconBack size={18} /></Link>
          <span>
            {rangeFmt.format(new Date(week + 'T12:00:00Z'))} – {rangeFmt.format(new Date(addDays(week, 6) + 'T12:00:00Z'))}
          </span>
          <Link prefetch={false} className="icon-btn" href={base({ semaine: addDays(week, 7) })} aria-label="Semaine suivante"><IconChevronRight size={18} /></Link>
          {week !== mondayOf(today) && <Link className="today-link" href="/pro/creneaux">Cette semaine</Link>}
        </nav>
        {active.length > 0 && panel !== 'new' && (
          <Link prefetch={false} className="btn btn-primary open-slots-btn" href={base({ date: week < today ? today : week })}>
            <IconPlus size={18} /> Ouvrir des créneaux
          </Link>
        )}
        </div>
      </header>
      {many && (
        <ul className="offer-legend" aria-label="Prestations">
          {active.map((o) => (
            <li key={o.id} style={{ ['--oc' as string]: o.color }}>{o.name}</li>
          ))}
        </ul>
      )}

      {venue.status !== 'published' && <p className="notice notice-amber">Ta fiche n’est pas encore en ligne : tes créneaux seront visibles dès sa validation.</p>}

      <div className={`slots-layout${panel ? ' has-panel' : ''}`}>
        <section className="week-grid" aria-label="Planning de la semaine">
          {weekDays.map((d) => {
            const daySlots = list.filter((r) => r.day === d);
            const past = d < today;
            return (
              <div key={d} className={`week-col${d === today ? ' today' : ''}${past ? ' past' : ''}`}>
                <div className="week-head">
                  <b>{capitalize(dayHead.format(new Date(d + 'T12:00:00Z')).replace('.', ''))}</b>
                  {daySlots.length > 0 && <span>{daySlots.length}</span>}
                </div>
                {daySlots.map((r) => {
                  const o = offerById.get(r.offer_id);
                  const gone = r.startsAt.getTime() < now;
                  const full = r.used >= r.capacity;
                  return (
                    <Link prefetch={false}
                      key={r.id}
                      href={base({ creneau: r.id })}
                      className={`slot-card${r.is_open ? '' : ' closed'}${gone ? ' gone' : ''}${editing?.id === r.id ? ' editing' : ''}${many ? ' tagged' : ''}`}
                      aria-current={editing?.id === r.id ? 'true' : undefined}
                      style={many && o ? { ['--oc' as string]: o.color } : undefined}
                      title={o ? `${o.name}, ${timeLabel(r.startsAt)}` : undefined}
                    >
                      <span className="slot-top">
                        <b className="num">{timeLabel(r.startsAt)}</b>
                        <span className="slot-pct">−{r.discount_pct} %</span>
                      </span>
                      {many && o && <span className="slot-offer">{o.name}</span>}
                      {o && <span className="slot-price">{euros(discounted(o.priceCents, r.discount_pct))}</span>}
                      <span className="slot-fill" title={`${r.used} / ${r.capacity}`}>
                        <i style={{ width: `${Math.min(100, (r.used / r.capacity) * 100)}%` }} />
                      </span>
                      <span className="slot-meta">{!r.is_open ? 'fermé' : full ? 'complet' : `${r.used}/${r.capacity} ${o?.capacityUnit === 'groupes' ? 'salles' : 'places'}`}</span>
                    </Link>
                  );
                })}
                {!past && (
                  <Link prefetch={false} className="slot-add" href={base({ date: d })} aria-label={`Ajouter un créneau le ${longDate(d)}`}>
                    <IconPlus size={16} /> Ajouter
                  </Link>
                )}
              </div>
            );
          })}
        </section>

        {panel && (
        <aside className="slots-side">
          {panel === 'edit' && editing && offerById.get(editing.offer_id) ? (
            <EditSlotForm
              key={editing.id}
              back={base({})}
              slot={{
                id: editing.id,
                dayLabel: `${capitalize(longDate(editing.day))} à ${timeLabel(editing.startsAt)}`,
                time: timeLabel(editing.startsAt),
                discountPct: editing.discount_pct,
                capacity: editing.capacity,
                used: editing.used,
                bookings: editing.nbook,
                isOpen: editing.is_open,
                past: editing.startsAt.getTime() < now,
                offer: offerById.get(editing.offer_id)!,
                list: slotBookings,
                canCancel: role === 'owner',
              }}
            />
          ) : (
            <NewSlotForm
              key={sp.date ?? week}
              venueId={venue.id}
              offers={active}
              defaultDate={isDateStr(sp.date) && sp.date >= today ? sp.date : week < today ? today : week}
              defaultPct={venue.baseDiscountPct}
              today={today}
              back={base({})}
            />
          )}
        </aside>
        )}
      </div>
    </>
  );
}
