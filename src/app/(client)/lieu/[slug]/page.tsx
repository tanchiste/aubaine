import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Deal, VenueArt } from '@/components/ui';
import { IconBack, IconClock, IconMinus, IconPin, IconPlus, IconUsers } from '@/components/icons';
import { getCurrentUser, getMyVenues } from '@/lib/auth';
import { CATEGORIES } from '@/lib/categories';
import { addDays, dayChip, euros, longDate, timeLabel } from '@/lib/format';
import { DAYS_AHEAD, clientParams, withParams } from '@/lib/params';
import { quote } from '@/lib/pricing';
import { photoList, unitsFor, venueBySlug, venueSlotsForDay } from '@/lib/venues';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = await venueBySlug((await params).slug);
  return { title: v ? v.name : 'Lieu introuvable' };
}

export default async function VenuePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const p = clientParams(await searchParams);
  const venue = await venueBySlug(slug);
  if (!venue) notFound();

  // Une fiche non publiée n'est visible que par son exploitant ou l'admin (aperçu).
  if (venue.status !== 'published') {
    const user = await getCurrentUser();
    const mine = user ? await getMyVenues(user.id) : [];
    if (!user || (!user.isAdmin && !mine.some((m) => m.venue.id === venue.id))) notFound();
  }

  const n = Math.min(venue.groupMax, Math.max(venue.groupMin, p.n));
  const [photos, slots] = await Promise.all([photoList(venue.id), venueSlotsForDay(venue.id, p.date)]);
  const need = unitsFor(venue, n);
  const selected = slots.find((s) => s.id === p.slot && s.remaining >= need) ?? null;
  const base = { date: p.date !== p.today ? p.date : undefined, n: n !== 2 ? n : undefined };
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(p.today, i));
  const price = selected ? quote(venue, n, selected.discountPct) : null;
  const cat = CATEGORIES[venue.category];

  return (
    <article style={{ paddingBottom: selected ? 90 : 0 }}>
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
          <span className="small muted" style={{ fontWeight: 600 }}>
            {cat.label} · {venue.area ? `${venue.area}, ` : ''}
            {venue.city}
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

      <section className="section" aria-labelledby="slots-title">
        <div className="section-title">
          <h2 id="slots-title">Créneaux creux</h2>
          <span className="small muted">{longDate(p.date)}</span>
        </div>
        <nav className="days" aria-label="Choisir le jour">
          {days.map((d) => {
            const c = dayChip(d, p.today);
            return (
              <Link key={d} className="day" href={withParams(`/lieu/${slug}`, base, { date: d === p.today ? undefined : d })} aria-current={d === p.date ? 'true' : undefined}>
                <span>{c.top}</span>
                <b>{c.num}</b>
              </Link>
            );
          })}
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

        {slots.length === 0 ? (
          <div className="empty card">
            <b>Pas de créneau creux ce jour-là</b>
            <p className="small">Regarde les jours suivants.</p>
          </div>
        ) : (
          <div className="slots" role="list">
            {slots.map((s) => {
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
    </article>
  );
}
