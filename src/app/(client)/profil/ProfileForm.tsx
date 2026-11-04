'use client';
import { useActionState } from 'react';
import { saveProfileAction, type ProfileState } from './actions';

type V = { firstName: string | null; lastName: string | null; phone: string | null; city: string | null; email: string };

export function ProfileForm({ v, cities }: { v: V; cities: string[] }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfileAction, {});
  return (
    <form action={action} className="card stack" aria-labelledby="me-title">
      <h2 id="me-title" style={{ fontSize: 16, fontWeight: 800 }}>Mes informations</h2>
      <div className="grid-2">
        <label className="field">
          <span>Prénom</span>
          <input className="input" name="firstName" defaultValue={v.firstName ?? ''} required maxLength={40} autoComplete="given-name" />
        </label>
        <label className="field">
          <span>Nom</span>
          <input className="input" name="lastName" defaultValue={v.lastName ?? ''} maxLength={40} autoComplete="family-name" />
        </label>
      </div>
      <div className="grid-2">
        <label className="field">
          <span>Téléphone</span>
          <input className="input" name="phone" type="tel" defaultValue={v.phone ?? ''} maxLength={20} autoComplete="tel" placeholder="0470 12 34 56" />
        </label>
        <label className="field">
          <span>Ma ville</span>
          <select className="select" name="city" defaultValue={v.city ?? ''}>
            <option value="">Tout le Hainaut</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="small muted">Email : {v.email}. Le prénom s’affiche à l’accueil quand tu arrives.</p>
      <div className="row">
        <button className="btn btn-primary btn-sm" disabled={pending}>{pending ? 'Enregistrement…' : 'Enregistrer'}</button>
        <span role="status" className="small">
          {state.error ? <span className="error">{state.error}</span> : state.ok ? <span style={{ color: 'var(--ok)', fontWeight: 700 }}>Enregistré.</span> : null}
        </span>
      </div>
    </form>
  );
}
