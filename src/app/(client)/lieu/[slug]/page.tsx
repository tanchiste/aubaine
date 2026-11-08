import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Deal, VenueArt } from '@/components/ui';
import { IconBack, IconChevronRight, IconClock, IconMinus, IconPin, IconPlus, IconUsers, IconX } from '@/components/icons';
import { getCurrentUser, getMyVenues } from '@/lib/auth';
import { CATEGORIES, catStyle } from '@/lib/categories';
import { addDays, brusselsDate, brusselsHour, capitalize, dayChip, euros, isDateStr, longDate, timeLabel } from '@/lib/format';
import { DAYS_AHEAD, MAX_DAYS, clientParams, withParams } from '@/lib/params';
import { DatePicker } from '@/components/DatePicker';
import { VenueMap } from '@/components/VenueMap';
import { POS_COOKIE, distanceKm, distanceLabel, hasPos, parsePos } from '@/lib/geo';
import { discounted, quote } from '@/lib/pricing';
import { offersOf, photoList, unitsFor, venueBySlug, venueSlotsRange, type SlotView } from '@/lib/venues';

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

  // Tous les jours réservables en une requête : la bande de dates montre où il reste de la place, semaine par semaine.
  const [photos, upcoming, offerMap] = await Promise.all([photoList(venue.id), venueSlotsRange(venue.id, p.today, MAX_DAYS), offersOf([venue.id])]);
  const offerList = (offerMap.get(venue.id) ?? []).filter((o) => o.isActive);
  const byDay = new Map<string, SlotView[]>();
  for (const s of upcoming) {
    const d = brusselsDate(s.startsAt);
    byDay.set(d, [...(byDay.get(d) ?? []), s]);
  }
  // Plus rien aujourd'hui (ou pas de date choisie) : on avance au prochain jour qui a des créneaux.
  if (!raw.date && !byDay.has(p.date) && upcoming.length > 0) p.date = brusselsDate(upcoming[0].startsAt);
  const daySlots = byDay.get(p.date) ?? [];
  // Plusieurs prestations : on en montre une à la fois (celle demandée, celle du créneau choisi, ou la première qui a des créneaux).
  const wanted = typeof raw.offre === 'string' ? raw.offre : undefined;
  const fromSlot = daySlots.find((s) => s.id === p.slot)?.offer.id;
  const offer =
    offerList.find((o) => o.id === wanted) ??
    offerList.find((o) => o.id === fromSlot) ??
    offerList.find((o) => daySlots.some((s) => s.offer.id === o.id)) ??
    offerList[0] ??
    null;
  const slots = offer ? daySlots.filter((s) => s.offer.id === offer.id) : daySlots;
  const n = offer ? Math.min(offer.groupMax, Math.max(offer.groupMin, p.n)) : p.n;
  const need = offer ? unitsFor(offer, n) : 1;
  const selected = slots.find((s) => s.id === p.slot && s.remaining >= need) ?? null;
  const base = {
    date: p.date !== p.today ? p.date : undefined,
    n: n !== 2 ? n : undefined,
    moment: p.moment,
    de: p.de,
    a: p.a,
    offre: offerList.length > 1 && offer ? offer.id : undefined,
    du: undefined as string | undefined,
  };
  // Venu d'Explorer avec « Matin », « Après-midi » ou « Soir » : on garde le même moment ici.
  const range = p.hours ?? null;
  const shown = range ? slots.filter((s) => brusselsHour(s.startsAt) >= range.from && brusselsHour(s.startsAt) < range.to) : slots;
  // Bande de 7 jours qui contient le jour choisi ; les flèches passent aux 7 jours d'avant ou d'après.
  const lastDay = addDays(p.today, MAX_DAYS - 1);
  // La dernière bande s'arrête au dernier jour réservable, toujours avec 7 jours.
  const lastStart = addDays(lastDay, -(DAYS_AHEAD - 1));
  const clampStart = (d: string) => (d > lastStart ? lastStart : d < p.today ? p.today : d);
  const startFor = (d: string) => clampStart(addDays(p.today, Math.floor(Math.max(0, Math.round((Date.parse(d) - Date.parse(p.today)) / 86_400_000)) / DAYS_AHEAD) * DAYS_AHEAD));
  // « du » garde la bande choisie avec les flèches tant que le jour sélectionné en fait partie.
  const du = typeof raw.du === 'string' && isDateStr(raw.du) ? clampStart(raw.du) : null;
  const start = du && p.date >= du && p.date <= addDays(du, DAYS_AHEAD - 1) ? du : startFor(p.date);
  base.du = start !== startFor(p.date) ? start : undefined;
  const windowOf = (from: string) => Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(from, i)).filter((d) => d <= lastDay);
  const days = windowOf(start);
  const prevStart = start > p.today ? clampStart(addDays(start, -DAYS_AHEAD)) : null;
  const nextStart = start < lastStart ? clampStart(addDays(start, DAYS_AHEAD)) : null;
  const price = selected && offer ? quote(offer, n, selected.discountPct) : null;
  const cat = CATEGORIES[venue.category];
  const me = parsePos((await cookies()).get(POS_COOKIE)?.value);
  const located = hasPos(venue) ? { lat: venue.lat!, lng: venue.lng! } : null;
  const km = me && located ? distanceKm(me, located) : null;
  // Ce qui est réservable pour cette prestation et ce groupe, jour par jour
  const usable = (s: SlotView) => (!offer || s.offer.id === offer.id) && s.remaining >= need && n >= s.offer.groupMin && n <= s.offer.groupMax;
  const daySummary = (d: string) => {
    const list = (byDay.get(d) ?? []).filter(usable);
    return { count: list.length, best: list.reduce((m, s) => Math.max(m, s.discountPct), 0) };
  };
  const nextFree = upcoming.find((s) => usable(s) && brusselsDate(s.startsAt) > p.date) ?? null;
  // En changeant de semaine, on se place sur le premier jour qui a de la place.
  const landOn = (from: string) => windowOf(from).find((d) => daySummary(d).count > 0) ?? from;
  const weekHref = (from: string) => {
    const d = landOn(from);
    return withParams(`/lieu/${slug}`, base, { date: d === p.today ? undefined : d, du: startFor(d) === from ? undefined : from, slot: undefined });
  };
  const firstFree = upcoming.find(usable) ?? null;
  const freeCount = shown.filter((s) => s.remaining >= need).length;
  const leftLabel = (s: SlotView) =>
    s.offer.capacityUnit === 'places' ? (s.remaining <= 3 ? `plus que ${s.remaining}` : `${s.remaining} places`) : s.remaining > 1 ? `${s.remaining} dispo` : 'libre';
  const whenLabel = (s: SlotView) => {
    const d = brusselsDate(s.startsAt);
    const c = dayChip(d, p.today);
    return `${d === p.today ? 'aujourd’hui' : d === addDays(p.today, 1) ? 'demain' : `${c.top.toLowerCase()} ${c.num}`} à ${timeLabel(s.startsAt)}`;
  };

  return (
    <article className={`fiche${selected ? ' has-cta' : ''}`}>
      <div className="fiche-main">
      <div className="hero">
        <VenueArt color={venue.color} style={{ height: '100%' }} category={photos.length ? undefined : venue.category}>
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
            <span className="cat-tag soft" style={catStyle(venue.category)}>{cat.label}</span>
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
          {offer && (
            <>
              <span className="fact"><IconClock size={16} /> {offer.durationMin} min</span>
              <span className="fact"><IconUsers size={16} /> {offer.groupMin === offer.groupMax ? offer.groupMax : `${offer.groupMin} à ${offer.groupMax}`} pers.</span>
              <span className="fact">{euros(offer.priceCents)} {offer.priceUnit === 'session' ? 'la séance' : 'par pers.'}</span>
            </>
          )}
          {km !== null && <span className="fact"><IconPin size={16} /> à {distanceLabel(km)}</span>}
        </div>
        {firstFree && (
          <a className="next-free" href="#creneaux">
            <span className="dot" aria-hidden="true" />
            <span className="grow">
              Prochain créneau : <b>{whenLabel(firstFree)}</b>
            </span>
            <span className="deal sm">−{firstFree.discountPct} %</span>
          </a>
        )}
        {venue.description && <p style={{ color: 'var(--ink-2)' }}>{venue.description}</p>}
        {venue.address && (
          <a className="row small" style={{ ['--gap' as string]: '6px', fontWeight: 600 }} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`} target="_blank" rel="noreferrer">
            <IconPin size={16} /> {venue.address}
          </a>
        )}
        {located && (
          <div className="map-card">
            <VenueMap single className="mini" me={me} pins={[{ id: venue.id, lat: located.lat, lng: located.lng, name: venue.name, pct: firstFree?.discountPct ?? venue.baseDiscountPct, line: '', href: '#creneaux' }]} />
            <a className="btn btn-sm" href={`https://www.google.com/maps/dir/?api=1&destination=${located.lat},${located.lng}`} target="_blank" rel="noreferrer">
              Itinéraire{km !== null ? ` · ${distanceLabel(km)}` : ''}
            </a>
          </div>
        )}
      </div>
      </div>

      <aside className="fiche-side">
      <section className="section" aria-labelledby="slots-title" id="creneaux">
        <div className="section-title">
          <h2 id="slots-title">Créneaux libres</h2>
          <span className="date-link">
            <DatePicker value={p.date} min={p.today} max={addDays(p.today, MAX_DAYS - 1)} hrefBase={withParams(`/lieu/${slug}`, base, { date: '__DATE__' })} label="Autre date" />
          </span>
        </div>
        {offerList.length > 1 && (
          <nav className="offer-tabs" aria-label="Choisir la prestation">
            {offerList.map((o) => (
              <Link key={o.id} href={withParams(`/lieu/${slug}`, base, { offre: o.id, slot: undefined })} aria-current={offer?.id === o.id ? 'true' : undefined} scroll={false}>
                <b>{o.name}</b>
                <span>{o.durationMin} min · {euros(o.priceCents)} {o.priceUnit === 'session' ? 'la séance' : '/ pers.'}</span>
              </Link>
            ))}
          </nav>
        )}
        <div className="days-wrap">
          {prevStart ? (
            <Link className="days-arrow" href={weekHref(prevStart)} aria-label="7 jours précédents" scroll={false}>
              <IconBack size={18} />
            </Link>
          ) : (
            <span className="days-arrow" aria-disabled="true"><IconBack size={18} /></span>
          )}
          <nav className="days avail" aria-label="Choisir le jour">
            {days.map((d) => {
              const c = dayChip(d, p.today);
              const sum = daySummary(d);
              return (
                <Link
                  key={d}
                  className={`day${sum.count ? '' : ' none'}`}
                  href={withParams(`/lieu/${slug}`, base, { date: d === p.today ? undefined : d })}
                  aria-current={d === p.date ? 'true' : undefined}
                  aria-label={`${capitalize(longDate(d))} : ${sum.count ? `${sum.count} créneau${sum.count > 1 ? 'x' : ''} libre${sum.count > 1 ? 's' : ''}, jusqu’à −${sum.best} %` : 'complet ou fermé'}`}
                  scroll={false}
                >
                  <span>{c.top}</span>
                  <b>{c.num}</b>
                  <em>{sum.count ? `−${sum.best} %` : '–'}</em>
                </Link>
              );
            })}
          </nav>
          {nextStart ? (
            <Link className="days-arrow" href={weekHref(nextStart)} aria-label="7 jours suivants" scroll={false}>
              <IconChevronRight size={18} />
            </Link>
          ) : (
            <span className="days-arrow" aria-disabled="true"><IconChevronRight size={18} /></span>
          )}
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="label">Personnes</span>
          <div className="stepper">
            <Link href={withParams(`/lieu/${slug}`, base, { n: n - 1, slot: selected?.id })} aria-label="Une personne de moins" aria-disabled={!offer || n <= offer.groupMin ? 'true' : undefined} scroll={false}>
              <IconMinus size={16} strokeWidth={2} />
            </Link>
            <b>{n}</b>
            <Link href={withParams(`/lieu/${slug}`, base, { n: n + 1, slot: selected?.id })} aria-label="Une personne de plus" aria-disabled={!offer || n >= offer.groupMax ? 'true' : undefined} scroll={false}>
              <IconPlus size={16} strokeWidth={2} />
            </Link>
          </div>
        </div>

        <div className="slots-head">
          <b>{capitalize(longDate(p.date))}</b>
          <span>
            {freeCount > 0 ? `${freeCount} créneau${freeCount > 1 ? 'x' : ''} libre${freeCount > 1 ? 's' : ''}` : 'aucun créneau libre'}
            {offer && freeCount > 0 ? ` · prix ${offer.priceUnit === 'session' ? 'la séance' : 'par pers.'}` : ''}
          </span>
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
            <b>{slots.length > 0 && range ? p.moment ? `Pas de créneau libre le ${range.label.toLowerCase()} ce jour-là` : `Pas de créneau libre entre ${range.from} h et ${range.to} h ce jour-là` : 'Pas de créneau libre ce jour-là'}</b>
            {slots.length > 0 && range ? (
              <Link className="btn btn-sm" href={withParams(`/lieu/${slug}`, base, { moment: undefined, de: undefined, a: undefined })}>Voir toute la journée</Link>
            ) : nextFree ? (
              <Link className="btn btn-sm btn-primary" href={withParams(`/lieu/${slug}`, base, { date: brusselsDate(nextFree.startsAt), slot: nextFree.id })} scroll={false}>
                Prochain : {whenLabel(nextFree)}
              </Link>
            ) : (
              <p className="small">Regarde les jours suivants.</p>
            )}
          </div>
        ) : (
          <div className="slots" role="list">
            {shown.map((s) => {
              const full = s.remaining < need;
              const boost = s.discountPct > venue.baseDiscountPct;
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
                  {!full && <span className="p">{euros(discounted(s.offer.priceCents, s.discountPct))}</span>}
                  {!full && <small>{leftLabel(s)}</small>}
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
              <b className="num" style={{ fontSize: 20 }}>{euros(price.total)}</b>
              <s className="muted small">{euros(price.full)}</s>
              <Deal pct={selected.discountPct} small />
            </div>
            <span className="small muted">
              {offer?.priceUnit === 'session' ? 'la séance' : `pour ${n} pers.`} · {timeLabel(selected.startsAt)}
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
