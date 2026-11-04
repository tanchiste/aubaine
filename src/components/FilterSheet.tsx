'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconMinus, IconPlus, IconX } from './icons';

type Moment = 'matin' | 'aprem' | 'soir';
type Sort = 'remise' | 'heure' | 'prix';
type Values = { n: number; moment?: Moment; de?: number; a?: number; sort: Sort };

const MOMENTS: [Moment, string][] = [['matin', 'Matin'], ['aprem', 'Après-midi'], ['soir', 'Soir']];
const SORTS: [Sort, string][] = [['remise', 'Meilleure remise'], ['heure', 'Plus tôt'], ['prix', 'Moins cher']];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 8);

/**
 * Sur téléphone : nombre de personnes, heure et tri regroupés dans un panneau,
 * pour garder l'écran d'accueil léger. `base` contient les autres paramètres (date, catégorie, ville…).
 */
export function FilterSheet({ base, current, maxPeople }: { base: Record<string, string | undefined>; current: Values; maxPeople: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Values>(current);
  const [precise, setPrecise] = useState(current.de !== undefined);

  useEffect(() => {
    if (!open) return;
    setV(current);
    setPrecise(current.de !== undefined);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, current]);

  const count = (current.n !== 2 ? 1 : 0) + (current.moment || current.de !== undefined ? 1 : 0) + (current.sort !== 'remise' ? 1 : 0);

  const apply = () => {
    const sp = new URLSearchParams();
    for (const [k, val] of Object.entries(base)) if (val) sp.set(k, val);
    if (v.n !== 2) sp.set('n', String(v.n));
    if (precise && v.de !== undefined && v.a !== undefined) {
      sp.set('de', String(v.de));
      sp.set('a', String(v.a));
    } else if (!precise && v.moment) sp.set('moment', v.moment);
    if (v.sort !== 'remise') sp.set('tri', v.sort);
    setOpen(false);
    const s = sp.toString();
    router.push(s ? `/?${s}` : '/');
  };

  return (
    <>
      <button type="button" className="chip filter-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
        Filtres
        {count > 0 && <span className="filter-count">{count}</span>}
      </button>

      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Filtres" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <b>Filtres</b>
              <button type="button" className="icon-btn" aria-label="Fermer" onClick={() => setOpen(false)}>
                <IconX size={18} />
              </button>
            </div>

            <div className="sheet-body">
              <section className="row" style={{ justifyContent: 'space-between' }}>
                <span className="label" style={{ fontSize: 15 }}>Combien de personnes ?</span>
                <div className="stepper">
                  <button type="button" aria-label="Une personne de moins" disabled={v.n <= 1} onClick={() => setV({ ...v, n: Math.max(1, v.n - 1) })}>
                    <IconMinus size={16} strokeWidth={2} />
                  </button>
                  <b>{v.n}</b>
                  <button type="button" aria-label="Une personne de plus" disabled={v.n >= maxPeople} onClick={() => setV({ ...v, n: Math.min(maxPeople, v.n + 1) })}>
                    <IconPlus size={16} strokeWidth={2} />
                  </button>
                </div>
              </section>

              <section className="stack" style={{ ['--gap' as string]: '10px' }}>
                <span className="label" style={{ fontSize: 15 }}>Quand dans la journée ?</span>
                <div className="sheet-options">
                  <button type="button" aria-pressed={!precise && !v.moment} onClick={() => { setPrecise(false); setV({ ...v, moment: undefined }); }}>Toute la journée</button>
                  {MOMENTS.map(([m, label]) => (
                    <button key={m} type="button" aria-pressed={!precise && v.moment === m} onClick={() => { setPrecise(false); setV({ ...v, moment: m }); }}>{label}</button>
                  ))}
                  <button type="button" aria-pressed={precise} onClick={() => { setPrecise(true); setV({ ...v, de: v.de ?? 14, a: v.a ?? 16 }); }}>Heure précise</button>
                </div>
                {precise && (
                  <div className="row" style={{ ['--gap' as string]: '8px' }}>
                    <label className="field grow">
                      <span>Entre</span>
                      <select className="select" value={v.de ?? 14} onChange={(e) => { const de = Number(e.target.value); setV({ ...v, de, a: (v.a ?? 16) <= de ? de + 1 : v.a }); }}>
                        {HOURS.filter((h) => h < 24).map((h) => <option key={h} value={h}>{h} h</option>)}
                      </select>
                    </label>
                    <label className="field grow">
                      <span>et</span>
                      <select className="select" value={v.a ?? 16} onChange={(e) => setV({ ...v, a: Number(e.target.value) })}>
                        {HOURS.filter((h) => h > (v.de ?? 14)).map((h) => <option key={h} value={h}>{h === 24 ? 'minuit' : `${h} h`}</option>)}
                      </select>
                    </label>
                  </div>
                )}
              </section>

              <section className="stack" style={{ ['--gap' as string]: '10px' }}>
                <span className="label" style={{ fontSize: 15 }}>Trier par</span>
                <div className="sheet-options">
                  {SORTS.map(([s, label]) => (
                    <button key={s} type="button" aria-pressed={v.sort === s} onClick={() => setV({ ...v, sort: s })}>{label}</button>
                  ))}
                </div>
              </section>
            </div>

            <div className="sheet-foot">
              <button type="button" className="btn" onClick={() => { setPrecise(false); setV({ n: 2, sort: 'remise' }); }}>Réinitialiser</button>
              <button type="button" className="btn btn-primary grow" onClick={apply}>Voir les offres</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
