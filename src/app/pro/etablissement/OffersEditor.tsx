'use client';
import { useActionState, useEffect, useState } from 'react';
import { removeOfferAction, saveOfferAction, toggleOfferAction, type FormState } from '../actions';

export type OfferValues = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  groupMin: number;
  groupMax: number;
  capacity: number;
  capacityUnit: 'places' | 'groupes';
  priceCents: number;
  priceUnit: 'person' | 'session';
  isActive: boolean;
};

const euro = (c: number) => (c / 100).toLocaleString('fr-BE', { minimumFractionDigits: c % 100 ? 2 : 0 }) + ' €';

function OfferForm({ venueId, o, onDone }: { venueId: string; o?: OfferValues; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveOfferAction, {});
  const [unit, setUnit] = useState<'places' | 'groupes'>(o?.capacityUnit ?? 'places');
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="offer-form stack" style={{ ['--gap' as string]: '12px' }}>
      <input type="hidden" name="venueId" value={venueId} />
      {o && <input type="hidden" name="offerId" value={o.id} />}
      <label className="field">
        <span>Nom</span>
        <input className="input" name="name" defaultValue={o?.name} required maxLength={50} placeholder="Ex. Session 15 min, Salle « La Prison »" autoFocus />
      </label>
      <div className="grid-2">
        <label className="field">
          <span>Prix normal (€)</span>
          <input className="input" name="price" inputMode="decimal" defaultValue={o && o.priceCents ? String(o.priceCents / 100).replace('.', ',') : ''} placeholder="22" required />
        </label>
        <div className="field">
          <span className="label">Le prix est</span>
          <div className="segmented" role="radiogroup">
            <label><input type="radio" name="priceUnit" value="person" defaultChecked={(o?.priceUnit ?? 'person') === 'person'} /><span>par pers.</span></label>
            <label><input type="radio" name="priceUnit" value="session" defaultChecked={o?.priceUnit === 'session'} /><span>la séance</span></label>
          </div>
        </div>
      </div>
      <div className="grid-3">
        <label className="field">
          <span>Durée (min)</span>
          <input className="input" name="durationMin" type="number" min={5} max={480} defaultValue={o?.durationMin ?? 60} required />
        </label>
        <label className="field">
          <span>Groupe min.</span>
          <input className="input" name="groupMin" type="number" min={1} max={50} defaultValue={o?.groupMin ?? 1} required />
        </label>
        <label className="field">
          <span>Groupe max.</span>
          <input className="input" name="groupMax" type="number" min={1} max={100} defaultValue={o?.groupMax ?? 6} required />
        </label>
      </div>
      <div className="field">
        <span className="label">Un créneau se remplit</span>
        <div className="segmented" role="radiogroup">
          <label><input type="radio" name="capacityUnit" value="places" checked={unit === 'places'} onChange={() => setUnit('places')} /><span>par places</span></label>
          <label><input type="radio" name="capacityUnit" value="groupes" checked={unit === 'groupes'} onChange={() => setUnit('groupes')} /><span>par salle ou piste</span></label>
        </div>
      </div>
      <label className="field" style={{ maxWidth: 220 }}>
        <span>{unit === 'places' ? 'Places par créneau' : 'Salles ou pistes en même temps'}</span>
        <input className="input" name="capacity" type="number" min={1} max={200} defaultValue={o?.capacity ?? (unit === 'places' ? 8 : 1)} required />
      </label>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <div className="row">
        <button className="btn btn-primary btn-sm" disabled={pending}>{pending ? 'Enregistrement…' : o ? 'Enregistrer' : 'Ajouter la prestation'}</button>
        <button type="button" className="btn btn-sm" onClick={onDone}>Annuler</button>
      </div>
    </form>
  );
}

/** Ce que l'établissement vend : une ou plusieurs prestations, chacune avec son prix et sa capacité */
export function OffersEditor({ venueId, offers, locked }: { venueId: string; offers: OfferValues[]; locked: boolean }) {
  const [editing, setEditing] = useState<string | null>(offers.length === 1 && offers[0].priceCents === 0 ? offers[0].id : null);
  return (
    <section className="card stack" aria-labelledby="f-offers">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 id="f-offers" style={{ fontSize: 15, fontWeight: 800 }}>Ce que tu proposes</h2>
        <span className="small muted">{offers.filter((o) => o.isActive).length} prestation{offers.filter((o) => o.isActive).length > 1 ? 's' : ''}</span>
      </div>
      <p className="small muted">Une prestation = une activité avec son prix : « Session 15 min », « Grand Prix 30 min », une salle d’escape… Tes créneaux s’y rattachent.</p>
      <ul className="offer-list">
        {offers.map((o) => (
          <li key={o.id} className={o.isActive ? '' : 'off'}>
            {editing === o.id ? (
              <OfferForm venueId={venueId} o={o} onDone={() => setEditing(null)} />
            ) : (
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span className="grow">
                  <b>{o.name}</b>
                  {!o.isActive && <span className="pill pill-muted" style={{ marginLeft: 6 }}>masquée</span>}
                  <span className="small muted" style={{ display: 'block' }}>
                    {o.priceCents ? `${euro(o.priceCents)} ${o.priceUnit === 'session' ? 'la séance' : 'par pers.'}` : 'Prix à indiquer'} · {o.durationMin} min · {o.groupMin} à {o.groupMax} pers. ·{' '}
                    {o.capacity} {o.capacityUnit === 'places' ? 'places' : o.capacity > 1 ? 'salles' : 'salle'}
                  </span>
                </span>
                {!locked && (
                  <span className="row" style={{ ['--gap' as string]: '6px' }}>
                    <button type="button" className="btn btn-sm" onClick={() => setEditing(o.id)}>Modifier</button>
                    {offers.length > 1 && (
                      <form action={o.isActive ? removeOfferAction : toggleOfferAction}>
                        <input type="hidden" name="venueId" value={venueId} />
                        <input type="hidden" name="offerId" value={o.id} />
                        <button className="btn btn-sm btn-danger">{o.isActive ? 'Retirer' : 'Réactiver'}</button>
                      </form>
                    )}
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
        {editing === 'new' && (
          <li>
            <OfferForm venueId={venueId} onDone={() => setEditing(null)} />
          </li>
        )}
      </ul>
      {!locked && editing !== 'new' && (
        <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setEditing('new')}>
          + Ajouter une prestation
        </button>
      )}
    </section>
  );
}
