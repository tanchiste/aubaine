'use client';
import { useActionState, useState } from 'react';
import { CATEGORIES, CATEGORY_KEYS, VENUE_COLORS } from '@/lib/categories';
import { saveVenueAction, type FormState } from '../actions';

export type VenueFormValues = {
  id: string;
  name: string;
  category: string;
  city: string;
  area: string | null;
  address: string | null;
  description: string | null;
  durationMin: number;
  groupMin: number;
  groupMax: number;
  capacity: number;
  capacityUnit: 'places' | 'groupes';
  priceCents: number;
  priceUnit: 'person' | 'session';
  baseDiscountPct: number;
  color: string;
};


export function VenueForm({ v, locked }: { v: VenueFormValues; locked: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveVenueAction, {});
  const [pct, setPct] = useState(v.baseDiscountPct);
  const [desc, setDesc] = useState(v.description ?? '');

  return (
    <form action={action} className="stack" style={{ ['--gap' as string]: '14px' }}>
      <input type="hidden" name="venueId" value={v.id} />
      <fieldset disabled={locked} style={{ border: 0, margin: 0, padding: 0, display: 'contents' }}>
        <section className="card stack" aria-labelledby="f-id">
          <h2 id="f-id" style={{ fontSize: 15, fontWeight: 800 }}>L’établissement</h2>
          <label className="field">
            <span>Nom</span>
            <input className="input" name="name" defaultValue={v.name} required minLength={2} maxLength={60} />
          </label>
          <div className="grid-2">
            <label className="field">
              <span>Activité</span>
              <select className="select" name="category" defaultValue={v.category}>
                {CATEGORY_KEYS.map((k) => (
                  <option key={k} value={k}>{CATEGORIES[k].label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Commune</span>
              <input className="input" name="city" defaultValue={v.city} required maxLength={40} />
            </label>
          </div>
          <div className="grid-2">
            <label className="field">
              <span>Quartier <em className="hint" style={{ fontStyle: 'normal' }}>(facultatif)</em></span>
              <input className="input" name="area" defaultValue={v.area ?? ''} maxLength={40} placeholder="Ex. Jemappes" />
            </label>
            <label className="field">
              <span>Adresse</span>
              <input className="input" name="address" defaultValue={v.address ?? ''} maxLength={120} placeholder="Rue, numéro, code postal" autoComplete="street-address" />
            </label>
          </div>
          <label className="field">
            <span>Description</span>
            <textarea className="textarea" name="description" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={800} placeholder="Ce que vivent les clients, en 2 ou 3 phrases : l’activité, l’ambiance, ce qui est compris." />
            <span className="hint">{desc.trim().length < 40 ? `Encore ${40 - desc.trim().length} caractères minimum` : `${desc.length} / 800`}</span>
          </label>
        </section>

        <section className="card stack" aria-labelledby="f-price">
          <h2 id="f-price" style={{ fontSize: 15, fontWeight: 800 }}>Remise habituelle</h2>
          <label className="field">
            <span>Remise proposée par défaut sur tes heures creuses : −{pct} %</span>
            <input type="range" name="baseDiscountPct" min={20} max={60} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} style={{ accentColor: 'var(--primary)' }} />
            <span className="hint">Entre −20 % et −60 %. Elle est proposée quand tu ouvres un créneau, et tu peux la changer créneau par créneau.</span>
          </label>
        </section>

        <section className="card stack" aria-labelledby="f-color">
          <h2 id="f-color" style={{ fontSize: 15, fontWeight: 800 }}>Couleur de la fiche</h2>
          <p className="small muted">Affichée tant que tu n’as pas de photo, et en petit à côté du nom.</p>
          <div className="colors" role="radiogroup" aria-labelledby="f-color">
            {VENUE_COLORS.map((c) => (
              <label key={c} title={c}>
                <input type="radio" name="color" value={c} defaultChecked={v.color === c} aria-label={`Couleur ${c}`} />
                <span style={{ ['--c' as string]: c }} />
              </label>
            ))}
          </div>
        </section>
      </fieldset>

      <div className="row" style={{ position: 'sticky', bottom: 76, zIndex: 5, padding: 12, background: 'rgba(255,255,255,0.95)', borderRadius: 16, boxShadow: '0 4px 20px rgba(23,20,46,0.08)' }}>
        <span className="grow small" role="status" aria-live="polite">
          {state.error ? <span className="error">{state.error}</span> : state.ok ? <span style={{ color: 'var(--ok)', fontWeight: 700 }}>{state.message}</span> : <span className="muted">Pense à enregistrer tes changements.</span>}
        </span>
        <button className="btn btn-primary" disabled={pending || locked}>{pending ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </form>
  );
}
