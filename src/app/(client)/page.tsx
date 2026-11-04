import Link from 'next/link';
import { cookies } from 'next/headers';
import { CityPicker } from '@/components/CityPicker';
import { DatePicker } from '@/components/DatePicker';
import { Deal, Logo, VenueArt } from '@/components/ui';
import { IconBolt, IconChevronRight, IconMinus, IconPlus, IconX } from '@/components/icons';
import { SearchBox } from '@/components/SearchBox';
import { CATEGORIES, CATEGORY_KEYS } from '@/lib/categories';
import { addDays, brusselsDate, dayChip, euros, longDate, relativeDay, timeLabel } from '@/lib/format';
import { CITY_COOKIE, DAYS_AHEAD, MAX_DAYS, MAX_PEOPLE, MOMENTS, SORTS, clientParams, withParams, type Moment, type Sort } from '@/lib/params';
import { discounted } from '@/lib/pricing';
import { bestDeals, cities, explorer, lastMinute, searchVenues } from '@/lib/venues';

type SP = Record<string, string | string[] | undefined>;

export default async function ExplorerPage({ searchParams }: { searchParams: Promise<SP> }) {
  const raw = await searchParams;
  const saved = (await cookies()).get(CITY_COOKIE)?.value;
  const p = clientParams(raw, saved ? decodeURIComponent(saved) : undefined);
  const { today, n, category, q, moment, sort, city } = p;
  const filters = { people: n, category, q, city };

  let date = p.date;
  const [first, lm, deals, cityList] = await Promise.all([
    explorer({ ...filters, date, moment, sort }),
    date === today && !category && !q && !moment ? lastMinute(today, n, city) : Promise.resolve([]),
    q ? Promise.resolve([]) : bestDeals({ ...filters, today }),
    cities(),
  ]);

  // Le soir, plus rien aujourd'hui : on montre directement demain.
  let items = first;
  let rolled = false;
  if (items.length === 0 && date === today && !raw.date) {
    const next = await explorer({ ...filters, date: addDays(today, 1), moment, sort });
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
    tri: sort !== 'remise' ? sort : undefined,
    ville: city ?? (raw.ville === 'tout' ? 'tout' : undefined),
  };
  // Filtres actifs, affichés avec une croix pour les retirer un par un.
  const active = [
    q ? { key: 'q', label: `« ${q} »`, remove: withParams('/', base, { q: undefined }) } : null,
    category ? { key: 'cat', label: CATEGORIES[category].short, remove: withParams('/', base, { cat: undefined }) } : null,
    moment ? { key: 'moment', label: MOMENTS[moment].label, remove: withParams('/', base, { moment: undefined }) } : null,
  ].filter((f): f is { key: string; label: string; remove: string } => f !== null);

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
      category && q ? attempt('cat', `« ${q} » dans toutes les activités`, { cat: undefined }, (d) => explorer({ ...filters, category: undefined, date: d, moment, sort })) : null,
      q ? attempt('q', category ? `Tous les lieux ${CATEGORIES[category].short}` : 'Tous les lieux, sans la recherche', { q: undefined }, (d) => explorer({ ...filters, q: undefined, date: d, moment, sort })) : null,
      moment ? attempt('moment', 'Toute la journée', { moment: undefined }, (d) => explorer({ ...filters, date: d, sort })) : null,
      city ? attempt('city', 'Tout le Hainaut', { ville: 'tout' }, (d) => explorer({ ...filters, city: undefined, date: d, moment, sort })) : null,
    ]);
    for (const f of found) if (f) fixes.push(f);
    for (let i = canRoll ? 2 : 1; i <= 6; i++) {
      const d = addDays(date, i);
      if (d > addDays(today, MAX_DAYS - 1)) break;
      const r = await explorer({ ...filters, date: d, moment, sort });
      if (r.length) {
        fixes.push({ key: 'day', label: `Le même choix ${relativeDay(d, today).toLowerCase()}`, href: withParams('/', base, { date: d }), n: r.length });
        break;
      }
    }
  }
  const what = [q ? `« ${q} »` : 'ce choix', category ? `en ${CATEGORIES[category].short}` : null, moment ? `le ${MOMENTS[moment].label.toLowerCase()}` : null, city ? `à ${city}` : null].filter(Boolean).join(' ');
  const when = date === today ? 'aujourd’hui' : relativeDay(date, today) === 'Demain' ? 'demain' : longDate(date);

  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
  const extraDay = !days.includes(date) ? date : null;
  const hrefFor: Record<string, string> = { tout: withParams('/', base, { ville: 'tout' }) };
  for (const c of cityList) hrefFor[c.city] = withParams('/', base, { ville: c.city });
  const place = city ?? 'du Hainaut';

  return (
    <div className="explore">
      <header className="client-head explore-head">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="only-mobile"><Logo /></span>
          <CityPicker cities={cityList} current={city} hrefFor={hrefFor} />
        </div>
        <h1 className="display explore-title">
          Les loisirs {city ? `de ${place}` : place},
          <br />à prix creux.
        </h1>
        <SearchBox
          key={q ?? ''}
          defaultValue={q}
          city={city}
          searchHref={withParams('/', { ...base, cat: undefined }, { q: '__Q__' })}
          categoryHref={withParams('/', { ...base, q: undefined }, { cat: '__CAT__' })}
        />
      </header>

      <section className="filters" aria-label="Filtres">
        <nav className="days" aria-label="Choisir le jour">
          {days.map((d) => {
            const c = dayChip(d, today);
            return (
              <Link key={d} className="day" href={withParams('/', base, { date: d === today ? undefined : d })} aria-current={d === date ? 'true' : undefined}>
                <span>{c.top}</span>
                <b>{c.num}</b>
              </Link>
            );
          })}
          {extraDay && (
            <Link className="day" href={withParams('/', base)} aria-current="true">
              <span>{dayChip(extraDay, today).top}</span>
              <b>{dayChip(extraDay, today).num}</b>
            </Link>
          )}
          <DatePicker value={date} min={today} max={addDays(today, MAX_DAYS - 1)} hrefBase={withParams('/', base, { date: '__DATE__' })} label="Plus tard" />
        </nav>

        <div className="filters-row">
          <div className="row" style={{ ['--gap' as string]: '12px' }}>
            <span className="label">Combien ?</span>
            <div className="stepper">
              <Link href={withParams('/', base, { n: n - 1 === 2 ? undefined : n - 1 })} aria-label="Une personne de moins" aria-disabled={n <= 1 ? 'true' : undefined}>
                <IconMinus size={16} strokeWidth={2} />
              </Link>
              <b>{n} pers.</b>
              <Link href={withParams('/', base, { n: n + 1 === 2 ? undefined : n + 1 })} aria-label="Une personne de plus" aria-disabled={n >= MAX_PEOPLE ? 'true' : undefined}>
                <IconPlus size={16} strokeWidth={2} />
              </Link>
            </div>
          </div>
          <nav className="seg" aria-label="Moment de la journée">
            <Link href={withParams('/', base, { moment: undefined })} aria-current={!moment ? 'true' : undefined}>Toute la journée</Link>
            {(Object.keys(MOMENTS) as Moment[]).map((m) => (
              <Link key={m} href={withParams('/', base, { moment: m })} aria-current={moment === m ? 'true' : undefined}>
                {MOMENTS[m].label}
              </Link>
            ))}
          </nav>
        </div>

        <nav className="chips" aria-label="Catégories">
          <Link className="chip" href={withParams('/', { ...base, q: undefined }, { cat: undefined })} aria-current={!category && !q ? 'true' : undefined}>
            Tout
          </Link>
          {CATEGORY_KEYS.filter((k) => k !== 'autre').map((k) => (
            <Link key={k} className="chip" href={withParams('/', { ...base, q: undefined }, { cat: k })} aria-current={category === k ? 'true' : undefined}>
              {CATEGORIES[k].short}
            </Link>
          ))}
        </nav>
        {active.length > 0 && (
          <div className="active-filters" aria-label="Filtres actifs">
            {active.map((f) => (
              <Link key={f.key} className="filter-pill" href={f.remove} aria-label={`Retirer le filtre ${f.label}`}>
                {f.label} <IconX size={12} />
              </Link>
            ))}
            {active.length > 1 && (
              <Link className="small" style={{ fontWeight: 700 }} href={withParams('/', { ...base, q: undefined, cat: undefined, moment: undefined })}>
                Tout effacer
              </Link>
            )}
          </div>
        )}
      </section>

      {deals.length > 0 && (
        <section className="section" aria-labelledby="deals-title">
          <div className="section-title">
            <h2 id="deals-title" className="row" style={{ ['--gap' as string]: '6px' }}>
              <IconBolt size={18} /> Meilleurs deals
            </h2>
            <span className="small muted">7 prochains jours{city ? `, ${city}` : ''}</span>
          </div>
          <div className="deals">
            {deals.map(({ venue, photoId, slot }) => {
              const d = brusselsDate(slot.startsAt);
              const unit = discounted(venue.priceCents, slot.discountPct);
              return (
                <Link key={venue.id} className="deal-card" href={withParams(`/lieu/${venue.slug}`, { n: base.n, date: d === today ? undefined : d, slot: slot.id })}>
                  <VenueArt color={venue.color} photoId={photoId} alt={venue.name}>
                    <Deal pct={slot.discountPct} />
                    <span className="cat-tag">{CATEGORIES[venue.category].short}</span>
                  </VenueArt>
                  <span className="deal-body">
                    <b className="deal-name">{venue.name}</b>
                    <span className="small muted">
                      {relativeDay(d, today)} · {timeLabel(slot.startsAt)} · {venue.city}
                    </span>
                    <span className="row" style={{ ['--gap' as string]: '6px', marginTop: 2 }}>
                      <b style={{ fontSize: 16 }}>{euros(unit)}</b>
                      <s className="small muted">{euros(venue.priceCents)}</s>
                      <span className="small muted">{venue.priceUnit === 'session' ? 'la séance' : '/ pers.'}</span>
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
          <nav className="sort" aria-label="Trier">
            {(Object.keys(SORTS) as Sort[]).map((s) => (
              <Link key={s} href={withParams('/', base, { tri: s === 'remise' ? undefined : s })} aria-current={sort === s ? 'true' : undefined}>
                {SORTS[s]}
              </Link>
            ))}
          </nav>
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
        ) : (
          <div className="venue-grid">
            {items.map(({ venue, photoId, slots }) => {
              const best = Math.max(...slots.map((s) => s.discountPct));
              const from = Math.min(...slots.map((s) => discounted(venue.priceCents, s.discountPct)));
              const shown = slots.slice(0, 3);
              const link = withParams(`/lieu/${venue.slug}`, { n: base.n, date: base.date ?? (rolled ? date : undefined) });
              return (
                <article key={venue.id} className="venue-card">
                  <Link className="venue-link" href={link}>
                    <VenueArt color={venue.color} photoId={photoId} alt={venue.name}>
                      <Deal pct={best} />
                      <span className="cat-tag">{CATEGORIES[venue.category].short}</span>
                    </VenueArt>
                    <div className="body">
                      <div className="row" style={{ alignItems: 'flex-start' }}>
                        <div className="grow stack" style={{ ['--gap' as string]: '2px' }}>
                          <h3 style={{ fontSize: 17, fontWeight: 800 }}>{venue.name}</h3>
                          <span className="small muted">
                            {venue.area ? `${venue.area}, ` : ''}
                            {venue.city}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="small muted">dès</span> <b style={{ fontSize: 17 }}>{euros(from)}</b>
                          <div className="small muted">{venue.priceUnit === 'session' ? 'la séance' : 'par pers.'}</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="mini-slots" style={{ padding: '0 14px 14px' }}>
                    {shown.map((s) => (
                      <Link key={s.id} className={`mini-slot${s.discountPct > venue.baseDiscountPct ? ' boost' : ''}`} href={withParams(`/lieu/${venue.slug}`, { n: base.n, date: base.date ?? (rolled ? date : undefined), slot: s.id })}>
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
                    <span className="cat-tag soft">{CATEGORIES[venue.category].short}</span>
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
