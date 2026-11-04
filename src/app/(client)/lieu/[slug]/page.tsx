import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Deal, VenueArt } from '@/components/ui';
import { IconBack, IconClock, IconMinus, IconPin, IconPlus, IconUsers, IconX } from '@/components/icons';
import { getCurrentUser, getMyVenues } from '@/lib/auth';
import { CATEGORIES } from '@/lib/categories';
import { addDays, brusselsHour, dayChip, euros, longDate, timeLabel } from '@/lib/format';
import { DAYS_AHEAD, MAX_DAYS, clientParams, withParams } from '@/lib/params';
import { DatePicker } from '@/components/DatePicker';
import { quote } from '@/lib/pricing';
import { photoList, unitsFor, venueBySlug, venueSlotsForDay } from '@/lib/venues';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = await venueBySlug((await params).slug);
  return { title: v ? v.name : 'Lieu introuvable' };
}

export default async function VenuePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const raw = await searchParams;
  const p = clientParams(raw);
  const venue = await venueBySlug(slug);
  if (!venue) notFound();

  // Une fiche non publiée n'est visible que par son exploitant ou l'admin (aperçu).
  if (venue.status !== 'published') {
    const user = await getCurrentUser();
    const mine = user ? await getMyVenues(user.id) : [];
    if (!user || (!user.isAdmin && !mine.some((m) => m.venue.id === venue.id))) notFound();
  }

  const n = Math.min(venue.groupMax, Math.max(venue.groupMin, p.n));
  const [photos, firstSlots] = await Promise.all([photoList(venue.id), venueSlotsForDay(venue.id, p.date)]);
  // Plus rien aujourd'hui (ou pas de date choisie) : on avance au prochain jour qui a des créneaux.
  let slots = firstSlots;
  if (slots.length === 0 && !raw.date) {
    for (let i = 1; i < 14; i++) {
      const next = await venueSlotsForDay(venue.id, addDays(p.today, i));
      if (next.length > 0) {
        slots = next;
        p.date = addDays(p.today, i);
        break;
      }
    }
  }
  const need = unitsFor(venue, n);
  const selected = slots.find((s) => s.id === p.slot && s.remaining >= need) ?? null;
  const base = { date: p.date !== p.today ? p.date : undefined, n: n !== 2 ? n : undefined, moment: p.moment, de: p.de, a: p.a };
  // Venu d'Explorer avec « Matin », « Après-midi » ou « Soir » : on garde le même moment ici.
  const range = p.hours ?? null;
  const shown = range ? slots.filter((s) => brusselsHour(s.startsAt) >= range.from && brusselsHour(s.startsAt) < range.to) : slots;
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(p.today, i));
  const price = selected ? quote(venue, n, selected.discountPct) : null;
  const cat = CATEGORIES[venue.category];

  return (
    <article className={`fiche${selected ? ' has-cta' : ''}`}>
      <div className="fiche-main">
      <div className="hero">
        <VenueArt color={venue.color} style={{ height: '100%' }}>
          {photos.length > 0 && (
            <div className="gallery" style={{ position: 'absolute', inset: 0 }}>
              {photos.map((ph, i) => (
                <img key={ph.id} src={`/api/photos/${ph.id}`} alt={`${venue.name}, photo ${i + 1}`} />
              ))}
            </div>
          )}
        </VenueArt>
        <Link className="icon-btn" href={withParams('/', base)} aria-label="Retour à Explorer">
          <IconBack />
        </Link>
      </div>

      <div className="section" style={{ paddingTop: 16 }}>
        {venue.status !== 'published' && (
          <p className="notice notice-amber">Aperçu : cette fiche n’est pas encore visible par les clients.</p>
        )}
        <div className="stack" style={{ ['--gap' as string]: '4px' }}>
          <span className="row" style={{ ['--gap' as string]: '8px' }}>
            <span className="cat-tag soft">{cat.label}</span>
            <span className="small muted" style={{ fontWeight: 600 }}>
              {venue.area ? `${venue.area}, ` : ''}
              {venue.city}
            </span>
          </span>
          <h1 className="display" style={{ fontSize: 26 }}>
            {venue.name}
          </h1>
        </div>
        <div className="facts">
          <span className="fact"><IconClock size={16} /> {venue.durationMin} min</span>
          <span className="fact"><IconUsers size={16} /> {venue.groupMin === venue.groupMax ? venue.groupMax : `${venue.groupMin} à ${venue.groupMax}`} pers.</span>
          <span className="fact">{euros(venue.priceCents)} {venue.priceUnit === 'session' ? 'la séance' : 'par pers.'}</span>
        </div>
        {venue.description && <p style={{ color: 'var(--ink-2)' }}>{venue.description}</p>}
        {venue.address && (
          <a className="row small" style={{ ['--gap' as string]: '6px', fontWeight: 600 }} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`} target="_blank" rel="noreferrer">
            <IconPin size={16} /> {venue.address}
          </a>
        )}
      </div>
      </div>

      <aside className="fiche-side">
      <section className="section" aria-labelledby="slots-title">
        <div className="section-title">
          <h2 id="slots-title">Créneaux creux</h2>
          <span className="small muted">{longDate(p.date)}</span>
        </div>
        <nav className="days" aria-label="Choisir le jour">
          {[...days, ...(days.includes(p.date) ? [] : [p.date])].map((d) => {
            const c = dayChip(d, p.today);
            return (
              <Link key={d} className="day" href={withParams(`/lieu/${slug}`, base, { date: d === p.today ? undefined : d })} aria-current={d === p.date ? 'true' : undefined}>
                <span>{c.top}</span>
                <b>{c.num}</b>
              </Link>
            );
          })}
          <DatePicker value={p.date} min={p.today} max={addDays(p.today, MAX_DAYS - 1)} hrefBase={withParams(`/lieu/${slug}`, base, { date: '__DATE__' })} label="Plus tard" />
        </nav>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="label">Personnes</span>
          <div className="stepper">
            <Link href={withParams(`/lieu/${slug}`, base, { n: n - 1, slot: selected?.id })} aria-label="Une personne de moins" aria-disabled={n <= venue.groupMin ? 'true' : undefined}>
              <IconMinus size={16} strokeWidth={2} />
            </Link>
            <b>{n}</b>
            <Link href={withParams(`/lieu/${slug}`, base, { n: n + 1, slot: selected?.id })} aria-label="Une personne de plus" aria-disabled={n >= venue.groupMax ? 'true' : undefined}>
              <IconPlus size={16} strokeWidth={2} />
            </Link>
          </div>
        </div>

        {range && (
          <div className="active-filters">
            <Link className="filter-pill" href={withParams(`/lieu/${slug}`, base, { moment: undefined, de: undefined, a: undefined, slot: selected?.id })} aria-label={`Retirer le filtre ${range.label}`}>
              {range.label} <IconX size={12} />
            </Link>
            {shown.length < slots.length && <span className="small muted">{slots.length - shown.length} autre{slots.length - shown.length > 1 ? 's' : ''} créneau{slots.length - shown.length > 1 ? 'x' : ''} dans la journée</span>}
          </div>
        )}
        {shown.length === 0 ? (
          <div className="empty card">
            <b>{slots.length > 0 && range ? p.moment ? `Pas de créneau creux le ${range.label.toLowerCase()} ce jour-là` : `Pas de créneau creux entre ${range.from} h et ${range.to} h ce jour-là` : 'Pas de créneau creux ce jour-là'}</b>
            {slots.length > 0 && range ? (
              <Link className="btn btn-sm" href={withParams(`/lieu/${slug}`, base, { moment: undefined, de: undefined, a: undefined })}>Voir toute la journée</Link>
            ) : (
              <p className="small">Regarde les jours suivants.</p>
            )}
          </div>
        ) : (
          <div className="slots" role="list">
            {shown.map((s) => {
              const full = s.remaining < need;
              const boost = s.discountPct > venue.baseDiscountPct;
              const few = !full && venue.capacityUnit === 'places' && s.remaining <= 3;
              return (
                <Link
                  key={s.id}
                  role="listitem"
                  className={`slot${boost ? ' boost' : ''}${full ? ' full' : ''}`}
                  href={withParams(`/lieu/${slug}`, base, { slot: s.id })}
                  aria-current={selected?.id === s.id ? 'true' : undefined}
                  aria-disabled={full ? 'true' : undefined}
                  scroll={false}
                >
                  <b>{timeLabel(s.startsAt)}</b>
                  <span className="d">{full ? 'Complet' : `−${s.discountPct} %`}</span>
                  {!full && (boost || few) && <small>{boost ? 'prix baissé' : `plus que ${s.remaining} places`}</small>}
                </Link>
              );
            })}
          </div>
        )}
        <p className="small muted">Annulation gratuite jusqu’à 2 h avant.</p>
      </section>

      {selected && price && (
        <div className="sticky-cta">
          <div className="grow">
            <div className="row" style={{ ['--gap' as string]: '8px' }}>
              <b style={{ fontSize: 20 }}>{euros(price.total)}</b>
              <s className="muted small">{euros(price.full)}</s>
              <Deal pct={selected.discountPct} small />
            </div>
            <span className="small muted">
              {venue.priceUnit === 'session' ? 'la séance' : `pour ${n} pers.`} · {timeLabel(selected.startsAt)}
            </span>
          </div>
          <Link className="btn btn-primary btn-lg" href={withParams('/reserver', { slot: selected.id, n })}>
            Réserver {timeLabel(selected.startsAt)}
          </Link>
        </div>
      )}
      </aside>
    </article>
  );
}
