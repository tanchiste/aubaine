import Link from 'next/link';
import { cookies } from 'next/headers';
import { CityPicker } from '@/components/CityPicker';
import { DatePicker } from '@/components/DatePicker';
import { Deal, Logo, VenueArt } from '@/components/ui';
import { HeroDial } from '@/components/brand';
import { IconBolt, IconChevronRight, IconX } from '@/components/icons';
import { SearchBox } from '@/components/SearchBox';
import { VenueMap, type MapPin } from '@/components/VenueMap';
import { DateMenu, PeopleMenu, SortMenu, TimeMenu } from '@/components/Menus';
import { CATEGORIES, CATEGORY_KEYS, catStyle } from '@/lib/categories';
import { addDays, brusselsDate, capitalize, dayChip, euros, longDate, relativeDay, timeLabel } from '@/lib/format';
import { CITY_COOKIE, DAYS_AHEAD, MAX_DAYS, MAX_PEOPLE, MOMENTS, SORTS, clientParams, withParams, type Moment, type Sort } from '@/lib/params';
import { discounted } from '@/lib/pricing';
import { POS_COOKIE, distanceKm, distanceLabel, hasPos, parsePos } from '@/lib/geo';
import type { Venue } from '@/db/schema';
import { bestDeals, cities, dayAvailability, explorer, lastMinute, minPrice, searchVenues, type DayAvailability } from '@/lib/venues';

type SP = Record<string, string | string[] | undefined>;

export default async function ExplorerPage({ searchParams }: { searchParams: Promise<SP> }) {
  const raw = await searchParams;
  const jar = await cookies();
  const saved = jar.get(CITY_COOKIE)?.value;
  const p = clientParams(raw, saved ? decodeURIComponent(saved) : undefined);
  const { today, n, category, q, moment, hours, city } = p;
  const filters = { people: n, category, q, city };
  // Position partagée par le navigateur (« Autour de moi ») : distances et tri par proximité.
  const pos = parsePos(jar.get(POS_COOKIE)?.value);
  const near = p.near && !!pos;
  const defaultSort: Sort = near ? 'proche' : 'remise';
  const sort: Sort = p.sort === 'proche' && !pos ? 'remise' : raw.tri ? p.sort : defaultSort;
  const kmTo = (v: Venue) => (pos && hasPos(v) ? distanceKm(pos, v) : null);
  const mapView = raw.vue === 'carte';

  let date = p.date;
  // Bande des jours : où il reste de la place avec ces filtres (au moins 7 jours, jusqu'au jour choisi)
  const availSpan = Math.max(DAYS_AHEAD, Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000) + 1);
  const [first, lm, deals, cityList, avail] = await Promise.all([
    explorer({ ...filters, date, hours, sort, from: pos }),
    date === today && !category && !q && !hours ? lastMinute(today, n, city) : Promise.resolve([]),
    q ? Promise.resolve([]) : bestDeals({ ...filters, today, hours }),
    cities(),
    dayAvailability({ ...filters, hours, from: today, days: availSpan }),
  ]);
  const availOf = (d: string): DayAvailability | undefined => avail.get(d);
  const availLabel = (d: string) => {
    const a = availOf(d);
    return a ? `${a.venues} lieu${a.venues > 1 ? 'x' : ''} · jusqu’à −${a.best} %` : 'aucun créneau';
  };

  // Le soir, plus rien aujourd'hui : on montre directement demain.
  let items = first;
  let rolled = false;
  if (items.length === 0 && date === today && !raw.date) {
    const next = await explorer({ ...filters, date: addDays(today, 1), hours, sort, from: pos });
    if (next.length > 0) {
      items = next;
      date = addDays(today, 1);
      rolled = true;
    }
  }

  // Recherche : les lieux qui correspondent mais n'ont rien ce jour-là, avec leur prochain créneau.
  const others = q ? (await searchVenues(q, { people: n, city })).filter((r) => !items.some((i) => i.venue.id === r.venue.id) && (!category || r.venue.category === category)) : [];

  const base = {
    date: date !== today ? date : undefined,
    n: n !== 2 ? n : undefined,
    cat: category,
    q,
    moment,
    de: p.de,
    a: p.a,
    tri: sort !== defaultSort ? sort : undefined,
    ville: near ? 'proche' : (city ?? (raw.ville === 'tout' ? 'tout' : undefined)),
    vue: mapView ? 'carte' : undefined,
  };
  const anyFilter = !!(category || q || hours || n !== 2 || sort !== defaultSort);

  // Rien trouvé : on teste ce qui donnerait des résultats en relâchant un filtre à la fois.
  const fixes: { key: string; label: string; href: string; n: number }[] = [];
  if (items.length === 0) {
    // Le soir, aujourd'hui est vide : on regarde aussi demain pour chaque alternative.
    const canRoll = date === today && !raw.date;
    const attempt = async (key: string, label: string, over: Record<string, string | undefined>, run: (d: string) => Promise<unknown[]>) => {
      const r = await run(date);
      if (r.length) return { key, label, href: withParams('/', base, over), n: r.length };
      if (canRoll) {
        const d = addDays(today, 1);
        const r2 = await run(d);
        if (r2.length) return { key, label: `${label}, demain`, href: withParams('/', base, { ...over, date: d }), n: r2.length };
      }
      return null;
    };
    const found = await Promise.all([
      category && q ? attempt('cat', `« ${q} » dans toutes les activités`, { cat: undefined }, (d) => explorer({ ...filters, category: undefined, date: d, hours, sort })) : null,
      q ? attempt('q', category ? `Tous les lieux ${CATEGORIES[category].short}` : 'Tous les lieux, sans la recherche', { q: undefined }, (d) => explorer({ ...filters, q: undefined, date: d, hours, sort })) : null,
      hours ? attempt('hours', 'Toute la journée', { moment: undefined, de: undefined, a: undefined }, (d) => explorer({ ...filters, date: d, sort })) : null,
      city ? attempt('city', 'Tout le Hainaut', { ville: 'tout' }, (d) => explorer({ ...filters, city: undefined, date: d, hours, sort })) : null,
    ]);
    for (const f of found) if (f) fixes.push(f);
    for (let i = canRoll ? 2 : 1; i <= 6; i++) {
      const d = addDays(date, i);
      if (d > addDays(today, MAX_DAYS - 1)) break;
      const r = await explorer({ ...filters, date: d, hours, sort });
      if (r.length) {
        fixes.push({ key: 'day', label: `Le même choix ${relativeDay(d, today).toLowerCase()}`, href: withParams('/', base, { date: d }), n: r.length });
        break;
      }
    }
  }
  const what = [q ? `« ${q} »` : 'ce choix', category ? `en ${CATEGORIES[category].short}` : null, hours ? (moment ? `le ${hours.label.toLowerCase()}` : `entre ${hours.from} h et ${hours.to} h`) : null, city ? `à ${city}` : null].filter(Boolean).join(' ');
  const when = date === today ? 'aujourd’hui' : relativeDay(date, today) === 'Demain' ? 'demain' : longDate(date);

  // En-tête vivant : combien de créneaux creux pour le jour affiché, et la meilleure remise (= la part rouge de l'horloge).
  const liveCount = items.reduce((t, i) => t + i.slots.length, 0);
  const liveBest = items.length ? Math.max(...items.flatMap((i) => i.slots.map((x) => x.discountPct))) : 0;
  const liveDay = rolled ? 'Demain' : date === today ? 'Aujourd’hui' : relativeDay(date, today);
  const live = liveCount
    ? `${liveDay} : ${liveCount} créneau${liveCount > 1 ? 'x' : ''} creux, jusqu’à −${liveBest} %`
    : `${liveDay} : pas de créneau creux pour ce choix`;

  const peopleHrefs = Array.from({ length: 12 }, (_, i) => withParams('/', base, { n: i + 1 === 2 ? undefined : i + 1 }));
  const timePresets = [
                { key: 'all', label: 'Toute la journée', hint: '', href: withParams('/', base, { moment: undefined, de: undefined, a: undefined }), active: !hours },
                ...(Object.keys(MOMENTS) as Moment[]).map((m) => ({
                  key: m,
                  label: MOMENTS[m].label,
                  hint: m === 'matin' ? 'avant 12 h' : m === 'soir' ? 'après 18 h' : '12 h – 18 h',
                  href: withParams('/', base, { moment: m, de: undefined, a: undefined }),
                  active: moment === m,
                })),
              ];
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
  const extraDay = !days.includes(date) ? date : null;
  const hrefFor: Record<string, string> = { tout: withParams('/', base, { ville: 'tout', tri: undefined }), proche: withParams('/', base, { ville: 'proche', tri: undefined }) };
  for (const c of cityList) hrefFor[c.city] = withParams('/', base, { ville: c.city });
  const place = city ?? 'du Hainaut';
  const where = near ? 'autour de toi' : city ? `de ${place}` : place;
  const pins: MapPin[] = items.filter((i) => hasPos(i.venue)).map(({ venue, slots }) => {
    const km = kmTo(venue);
    return {
      id: venue.id,
      lat: venue.lat!,
      lng: venue.lng!,
      name: venue.name,
      pct: Math.max(...slots.map((s) => s.discountPct)),
      line: [`dès ${euros(minPrice(slots))}`, `${slots.length} créneau${slots.length > 1 ? 'x' : ''}`, km !== null ? distanceLabel(km) : venue.city].join(' · '),
      href: withParams(`/lieu/${venue.slug}`, { n: base.n, moment, de: p.de, a: p.a, date: base.date ?? (rolled ? date : undefined) }),
    };
  });

  return (
    <div className="explore">
      <header className="hero-band">
        <div className="hero-top">
          <span className="only-mobile"><Logo dark /></span>
          <CityPicker cities={cityList} current={city} near={near} hasPos={!!pos} hrefFor={hrefFor} />
        </div>
        <div className="hero-copy">
          <h1 className="display explore-title">
            Les loisirs {where},
            <br />à prix creux.
          </h1>
          <p className="hero-live">{live}</p>
        </div>
        <div className="hero-dial-clip" aria-hidden="true">
          <HeroDial pct={liveBest} />
        </div>
        <SearchBox
          key={q ?? ''}
          defaultValue={q}
          city={city}
          searchHref={withParams('/', { ...base, cat: undefined }, { q: '__Q__' })}
          categoryHref={withParams('/', { ...base, q: undefined }, { cat: '__CAT__' })}
        />
      </header>

      <section className="filters" aria-label="Filtres">
        <div className="quickbar" aria-label="Jour, personnes et horaire">
          <DateMenu
            label={date === today && !rolled ? 'Aujourd’hui' : relativeDay(date, today)}
            value={date}
            min={today}
            max={addDays(today, MAX_DAYS - 1)}
            isToday={date === today && !rolled}
            isTomorrow={date === addDays(today, 1)}
            todayInfo={availLabel(today)}
            tomorrowInfo={availLabel(addDays(today, 1))}
            todayHref={withParams('/', base, { date: undefined })}
            tomorrowHref={withParams('/', base, { date: addDays(today, 1) })}
            pickHref={withParams('/', base, { date: '__DATE__' })}
          />
          <PeopleMenu n={n} hrefs={peopleHrefs} />
          <TimeMenu
            pill
            label={hours ? hours.label : 'Journée'}
            de={p.de}
            a={p.a}
            preciseHref={withParams('/', { ...base, moment: undefined }, { de: '__DE__', a: '__A__' })}
            presets={timePresets}
          />
        </div>
        <div className="toolbar">
          <div className="tool tool-days">
            <span className="tool-label">Jour</span>
            <nav className="days days-full avail" aria-label="Choisir le jour">
              {[...days, ...(extraDay ? [extraDay] : [])].map((d) => {
                const c = dayChip(d, today);
                const a = availOf(d);
                return (
                  <Link
                    scroll={false}
                    key={d}
                    className={`day${a ? '' : ' none'}`}
                    href={d === extraDay ? withParams('/', base) : withParams('/', base, { date: d === today ? undefined : d })}
                    aria-current={d === date ? 'true' : undefined}
                    title={a ? `${a.venues} lieu${a.venues > 1 ? 'x' : ''}, ${a.slots} créneau${a.slots > 1 ? 'x' : ''}, jusqu’à −${a.best} %` : 'Aucun créneau avec ces filtres'}
                    aria-label={`${capitalize(longDate(d))} : ${availLabel(d)}`}
                  >
                    <span>{c.top}</span>
                    <b>{c.num}</b>
                    <em>{a ? `−${a.best} %` : '–'}</em>
                  </Link>
                );
              })}
              <DatePicker value={date} min={today} max={addDays(today, MAX_DAYS - 1)} hrefBase={withParams('/', base, { date: '__DATE__' })} label="Plus tard" />
            </nav>
          </div>
          <div className="tool">
            <span className="tool-label">Personnes</span>
            <PeopleMenu tool n={n} hrefs={peopleHrefs} />
          </div>
          <div className="tool">
            <span className="tool-label">Horaire</span>
            <TimeMenu
              label={hours ? hours.label : 'Toute la journée'}
              shortLabel={hours ? hours.label : 'Journée'}
              de={p.de}
              a={p.a}
              preciseHref={withParams('/', { ...base, moment: undefined }, { de: '__DE__', a: '__A__' })}
              presets={timePresets}
            />
          </div>
        </div>

        <div className="cats-row">
          <nav className="chips" aria-label="Catégories">
            <Link scroll={false} className="chip chip-all" href={withParams('/', { ...base, q: undefined }, { cat: undefined })} aria-current={!category && !q ? 'true' : undefined}>
              Tout
            </Link>
            {CATEGORY_KEYS.filter((k) => k !== 'autre').map((k) => (
              <Link scroll={false} key={k} className="chip cat-chip" style={catStyle(k)} href={withParams('/', { ...base, q: undefined }, { cat: k })} aria-current={category === k ? 'true' : undefined}>
                {CATEGORIES[k].short}
              </Link>
            ))}
          </nav>
          {anyFilter && (
            <Link scroll={false} className="reset-link" href={withParams('/', { ville: base.ville, date: base.date })}>
              Réinitialiser
            </Link>
          )}
        </div>

      </section>

      {deals.length > 0 && (
        <section className="section" aria-labelledby="deals-title">
          <div className="section-title">
            <h2 id="deals-title" className="row" style={{ ['--gap' as string]: '6px' }}>
              <IconBolt size={18} /> Meilleurs deals
            </h2>
            <span className="small muted">7 prochains jours{hours ? `, ${moment ? hours.label.toLowerCase() : hours.label}` : ''}{city ? `, ${city}` : ''}</span>
          </div>
          <div className="deals">
            {deals.map(({ venue, photoId, slot }) => {
              const d = brusselsDate(slot.startsAt);
              const unit = discounted(slot.offer.priceCents, slot.discountPct);
              return (
                <Link key={venue.id} className="deal-card" href={withParams(`/lieu/${venue.slug}`, { n: base.n, moment, de: p.de, a: p.a, date: d === today ? undefined : d, slot: slot.id })}>
                  <VenueArt color={venue.color} photoId={photoId} alt={venue.name} category={venue.category}>
                    <Deal pct={slot.discountPct} />
                    <span className="cat-tag" style={catStyle(venue.category)}>{CATEGORIES[venue.category].short}</span>
                  </VenueArt>
                  <span className="deal-body">
                    <b className="deal-name">{venue.name}</b>
                    {/* Même lecture que les cartes des lieux : infos à gauche, prix remisé à droite avec le prix normal barré */}
                    <span className="deal-foot">
                      <span className="small muted">
                        {relativeDay(d, today)} · {timeLabel(slot.startsAt)}
                        <br />
                        {kmTo(venue) !== null ? `à ${distanceLabel(kmTo(venue)!)}` : venue.city}
                      </span>
                      <span className="card-price" aria-label={`${euros(unit)} au lieu de ${euros(slot.offer.priceCents)}, ${slot.offer.priceUnit === 'session' ? 'la séance' : 'par personne'}`}>
                        <b className="num">{euros(unit)}</b>
                        <span className="small muted">
                          <s>{euros(slot.offer.priceCents)}</s> {slot.offer.priceUnit === 'session' ? 'la séance' : 'par pers.'}
                        </span>
                      </span>
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {lm.length > 0 && (
        <section className="section" aria-labelledby="lm-title">
          <div className="section-title">
            <h2 id="lm-title">Dernière minute</h2>
            <span className="small muted">dans les 3 prochaines heures</span>
          </div>
          <div className="last-minute">
            {lm.map(({ venue, photoId, slot }) => (
              <Link key={venue.id} className="lm-card" href={withParams(`/lieu/${venue.slug}`, { n: base.n, slot: slot.id })}>
                <VenueArt color={venue.color} photoId={photoId} />
                <span className="grow stack" style={{ ['--gap' as string]: '2px' }}>
                  <b style={{ fontSize: 14 }}>{venue.name}</b>
                  <span className="small muted">
                    {timeLabel(slot.startsAt)} · {CATEGORIES[venue.category].short}
                  </span>
                </span>
                <Deal pct={slot.discountPct} small />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="list-title">
        <div className="section-title" style={{ flexWrap: 'wrap', rowGap: 8 }}>
          <h2 id="list-title">
            {q ? `Résultats pour « ${q} »` : rolled ? 'Demain' : date === today ? 'Aujourd’hui' : longDate(date).replace(/^./, (c) => c.toUpperCase())}
            <span className="small muted" style={{ fontWeight: 500, marginLeft: 8 }}>
              {items.length} lieu{items.length > 1 ? 'x' : ''}
            </span>
          </h2>
          <div className="row" style={{ ['--gap' as string]: '10px' }}>
            <nav className="view-toggle" aria-label="Affichage">
              <Link scroll={false} href={withParams('/', base, { vue: undefined })} aria-current={!mapView ? 'true' : undefined}>Liste</Link>
              <Link scroll={false} href={withParams('/', base, { vue: 'carte' })} aria-current={mapView ? 'true' : undefined}>Carte</Link>
            </nav>
            <SortMenu
              options={(Object.keys(SORTS) as Sort[])
                .filter((k) => k !== 'proche' || pos)
                .map((k) => ({ key: k, label: SORTS[k], href: withParams('/', base, { tri: k === defaultSort ? undefined : k }), active: sort === k }))}
            />
          </div>
        </div>
        {rolled && <p className="notice notice-primary small">Plus de créneau creux aujourd’hui : voici ceux de demain.</p>}

        {items.length === 0 ? (
          <div className="empty card" style={{ alignItems: 'stretch', textAlign: 'left' }}>
            <b>Rien pour {what} {when}.</b>
            {fixes.length > 0 ? (
              <>
                <p className="small">Essaie plutôt :</p>
                <div className="fixes">
                  {fixes.map((f) => (
                    <Link key={f.key} className="fix" href={f.href}>
                      <span className="grow">{f.label}</span>
                      <span className="small muted">{f.n} lieu{f.n > 1 ? 'x' : ''}</span>
                      <IconChevronRight size={16} />
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <p className="small">Aucun créneau ne correspond pour l’instant. De nouveaux lieux arrivent chaque semaine.</p>
            )}
          </div>
        ) : mapView ? (
          <div className="map-wrap">
            <VenueMap pins={pins} me={pos} />
            {pins.length < items.length && <p className="small muted">{items.length - pins.length} lieu{items.length - pins.length > 1 ? 'x' : ''} pas encore placé{items.length - pins.length > 1 ? 's' : ''} sur la carte.</p>}
          </div>
        ) : (
          <div className="venue-grid">
            {items.map(({ venue, photoId, slots }) => {
              const best = Math.max(...slots.map((s) => s.discountPct));
              const from = minPrice(slots);
              const cheapest = slots.reduce((m, s) => (discounted(s.offer.priceCents, s.discountPct) < discounted(m.offer.priceCents, m.discountPct) ? s : m));
              const shown = slots.slice(0, 3);
              const link = withParams(`/lieu/${venue.slug}`, { n: base.n, moment, de: p.de, a: p.a, date: base.date ?? (rolled ? date : undefined) });
              return (
                <article key={venue.id} className="venue-card">
                  <Link className="venue-link" href={link}>
                    <VenueArt color={venue.color} photoId={photoId} alt={venue.name} category={venue.category}>
                      <Deal pct={best} />
                      <span className="cat-tag" style={catStyle(venue.category)}>{CATEGORIES[venue.category].short}</span>
                    </VenueArt>
                    <div className="body">
                      <div className="row" style={{ alignItems: 'flex-start' }}>
                        <div className="grow stack" style={{ ['--gap' as string]: '2px', minWidth: 0 }}>
                          <h3 style={{ fontSize: 17, fontWeight: 800 }}>{venue.name}</h3>
                          <span className="small muted">
                            {venue.area ? `${venue.area}, ` : ''}
                            {venue.city}
                            {kmTo(venue) !== null && <b className="km"> · {distanceLabel(kmTo(venue)!)}</b>}
                          </span>
                        </div>
                        {/* Même lecture que les meilleurs deals : infos à gauche, prix remisé à droite avec le prix normal barré */}
                        <div className="card-price" aria-label={`À partir de ${euros(from)} au lieu de ${euros(cheapest.offer.priceCents)}, ${cheapest.offer.priceUnit === 'session' ? 'la séance' : 'par personne'}, remise comprise`}>
                          <span>
                            <span className="small muted">dès</span> <b className="num">{euros(from)}</b>
                          </span>
                          <span className="small muted">
                            <s>{euros(cheapest.offer.priceCents)}</s> {cheapest.offer.priceUnit === 'session' ? 'la séance' : 'par pers.'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="mini-slots" style={{ padding: '0 14px 14px' }}>
                    {shown.map((s) => (
                      <Link key={s.id} className={`mini-slot${s.discountPct > venue.baseDiscountPct ? ' boost' : ''}`} href={withParams(`/lieu/${venue.slug}`, { n: base.n, moment, de: p.de, a: p.a, date: base.date ?? (rolled ? date : undefined), slot: s.id })}>
                        {timeLabel(s.startsAt)} <em>−{s.discountPct} %</em>
                      </Link>
                    ))}
                    {slots.length > shown.length && (
                      <Link className="mini-slot" href={link}>
                        +{slots.length - shown.length}
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {others.length > 0 && (
        <section className="section" aria-labelledby="others-title">
          <div className="section-title">
            <h2 id="others-title">{items.length ? 'Aussi d’autres jours' : `« ${q} » : pas de créneau ce jour-là`}</h2>
            <span className="small muted">prochain créneau disponible</span>
          </div>
          <div className="venue-grid">
            {others.map(({ venue, photoId, next, best }) => (
              <Link key={venue.id} className="venue-card row" href={withParams(`/lieu/${venue.slug}`, { n: base.n })} style={{ padding: 10, textDecoration: 'none', color: 'var(--ink)', ['--gap' as string]: '12px' }}>
                <VenueArt className="swatch" color={venue.color} photoId={photoId} style={{ width: 64, height: 64, borderRadius: 14 }} />
                <span className="grow stack" style={{ ['--gap' as string]: '3px' }}>
                  <span className="row" style={{ ['--gap' as string]: '6px' }}>
                    <b>{venue.name}</b>
                    <span className="cat-tag soft" style={catStyle(venue.category)}>{CATEGORIES[venue.category].short}</span>
                  </span>
                  <span className="small muted">
                    {venue.city}
                    {next ? ` · prochain créneau ${relativeDay(brusselsDate(next), today).toLowerCase()} à ${timeLabel(next)}` : ' · pas de créneau pour l’instant'}
                  </span>
                </span>
                {best ? <Deal pct={best} small /> : null}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
