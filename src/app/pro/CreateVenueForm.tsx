'use client';
import { useActionState } from 'react';
import { CATEGORIES, CATEGORY_KEYS } from '@/lib/categories';
import { createVenueAction, type FormState } from './actions';

export function CreateVenueForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createVenueAction, {});
  return (
    <form action={action} className="card stack" style={{ ['--gap' as string]: '14px' }}>
      <label className="field">
        <span>Nom de l’établissement</span>
        <input className="input" name="name" required minLength={2} maxLength={60} placeholder="Ex. Kart’Ohm" autoFocus />
      </label>
      <label className="field">
        <span>Activité</span>
        <select className="select" name="category" required defaultValue="">
          <option value="" disabled>Choisir…</option>
          {CATEGORY_KEYS.map((k) => (
            <option key={k} value={k}>{CATEGORIES[k].label}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Commune</span>
        <input className="input" name="city" required defaultValue="Mons" maxLength={40} />
      </label>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn btn-primary btn-lg" disabled={pending}>{pending ? 'Création…' : 'Créer ma fiche'}</button>
      <p className="small muted">Gratuit. Tu complètes ensuite la fiche (prix, photos, remise) et on la valide sous 24 h.</p>
    </form>
  );
}
