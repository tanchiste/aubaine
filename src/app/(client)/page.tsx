import Link from 'next/link';
import { Deal, Logo, VenueArt } from '@/components/ui';
import { IconMinus, IconPin, IconPlus, IconSearch } from '@/components/icons';
import { CATEGORIES, CATEGORY_KEYS } from '@/lib/categories';
import { addDays, dayChip, euros, timeLabel } from '@/lib/format';
import { DAYS_AHEAD, MAX_PEOPLE, clientParams, withParams } from '@/lib/params';
import { discounted } from '@/lib/pricing';
import { explorer, lastMinute } from '@/lib/venues';

export default async function ExplorerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = clientParams(await searchParams);
  const { today, n, category, q } = p;
  let date = p.date;
  const [first, lm] = await Promise.all([
    explorer({ date, people: n, category, q }),
    date === today && !category && !q ? lastMinute(today, n) : Promise.resolve([]),
  ]);
  // Le soir, plus rien aujourd'hui : on montre directement demain.
  let items = first;
  let rolled = false;
  if (items.length === 0 && date === today) {
    const tomorrow = addDays(today, 1);
    const next = await explorer({ date: tomorrow, people: n, category, q });
    if (next.length > 0) {
      items = next;
      date = tomorrow;
      rolled = true;
    }
  }
  const base = { date: date !== today ? date : undefined, n: n !== 2 ? n : undefined, cat: category, q };
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));

  return (
    <>
      <header className="client-head">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Logo />
          <span className="chip" style={{ background: 'var(--soft)', gap: 5 }}>
            <IconPin size={16} /> Hainaut
          </span>
        </div>
        <h1 className="display" style={{ fontSize: 26, lineHeight: 1.15 }}>
          Les loisirs de Mons,
          <br />à prix creux.
        </h1>
        <form className="search" role="search" action="/">
          <IconSearch size={18} />
          <input className="input" type="search" name="q" defaultValue={q} placeholder="Karting, escape game, Mons…" aria-label="Rechercher une activité" />
          {base.date && <input type="hidden" name="date" value={base.date} />}
          {base.n && <input type="hidden" name="n" value={base.n} />}
          {category && <input type="hidden" name="cat" value={category} />}
        </form>
      </header>

      <div className="section">
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
        </nav>
        <div className="row" style={{ justifyContent: 'space-between' }}>
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
        <nav className="chips" aria-label="Catégories">
          <Link className="chip" href={withParams('/', base, { cat: undefined })} aria-current={!category ? 'true' : undefined}>
            Tout
          </Link>
          {CATEGORY_KEYS.filter((k) => k !== 'autre').map((k) => (
            <Link key={k} className="chip" href={withParams('/', base, { cat: k })} aria-current={category === k ? 'true' : undefined}>
              {CATEGORIES[k].short}
            </Link>
          ))}
        </nav>
      </div>

      {lm.length > 0 && (
        <section className="section" aria-labelledby="lm-title">
          <div className="section-title">
            <h2 id="lm-title">Dernière minute</h2>
            <span className="small muted">dans les 3 prochaines heures</span>
          </div>
          <div className="last-minute">
            {lm.map(({ venue, photoId, slot }) => (
              <Link key={venue.id} className="lm-card" href={withParams(`/lieu/${venue.slug}`, base, { slot: slot.id })}>
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
        <div className="section-title">
          <h2 id="list-title">{q ? `Résultats pour « ${q} »` : category ? CATEGORIES[category].label : rolled ? 'Demain' : 'Créneaux creux'}</h2>
          <span className="small muted">
            {items.length} lieu{items.length > 1 ? 'x' : ''}
          </span>
        </div>

        {rolled && <p className="notice notice-primary small">Plus de créneau creux aujourd’hui : voici ceux de demain.</p>}
        {items.length === 0 ? (
          <div className="empty card">
            <b>Rien de disponible pour ce choix</b>
            <p className="small">Essaie un autre jour, un autre nombre de personnes ou une autre catégorie.</p>
            <Link className="btn btn-sm" href="/">
              Tout afficher
            </Link>
          </div>
        ) : (
          items.map(({ venue, photoId, slots }) => {
            const best = Math.max(...slots.map((s) => s.discountPct));
            const from = Math.min(...slots.map((s) => discounted(venue.priceCents, s.discountPct)));
            const shown = slots.slice(0, 3);
            return (
              <article key={venue.id} className="venue-card">
                <Link className="venue-link" href={withParams(`/lieu/${venue.slug}`, base)}>
                  <VenueArt color={venue.color} photoId={photoId} alt={venue.name}>
                    <Deal pct={best} />
                  </VenueArt>
                  <div className="body">
                    <div className="row" style={{ alignItems: 'flex-start' }}>
                      <div className="grow stack" style={{ ['--gap' as string]: '2px' }}>
                        <h3 style={{ fontSize: 17, fontWeight: 800 }}>{venue.name}</h3>
                        <span className="small muted">
                          {CATEGORIES[venue.category].label} · {venue.area ? `${venue.area}, ` : ''}
                          {venue.city}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="small muted">dès</span>{' '}
                        <b style={{ fontSize: 17 }}>{euros(from)}</b>
                        <div className="small muted">{venue.priceUnit === 'session' ? 'la séance' : 'par pers.'}</div>
                      </div>
                    </div>
                  </div>
                </Link>
                <div className="mini-slots" style={{ padding: '0 14px 14px' }}>
                  {shown.map((s) => (
                    <Link key={s.id} className={`mini-slot${s.discountPct > venue.baseDiscountPct ? ' boost' : ''}`} href={withParams(`/lieu/${venue.slug}`, base, { slot: s.id })}>
                      {timeLabel(s.startsAt)} <em>−{s.discountPct} %</em>
                    </Link>
                  ))}
                  {slots.length > shown.length && (
                    <Link className="mini-slot" href={withParams(`/lieu/${venue.slug}`, base)}>
                      +{slots.length - shown.length}
                    </Link>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </>
  );
}
