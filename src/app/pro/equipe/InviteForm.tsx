'use client';
import { useActionState, useEffect, useRef } from 'react';
import { inviteAction, type TeamState } from './actions';

export function InviteForm() {
  const [state, action, pending] = useActionState<TeamState, FormData>(inviteAction, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="card stack" aria-labelledby="inv-title">
      <h2 id="inv-title" style={{ fontSize: 16, fontWeight: 800 }}>Ajouter quelqu’un</h2>
      <div className="grid-2">
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" name="email" required placeholder="prenom@exemple.be" />
        </label>
        <label className="field">
          <span>Prénom</span>
          <input className="input" name="firstName" maxLength={40} />
        </label>
      </div>
      <div className="field">
        <span className="label">Rôle</span>
        <div className="segmented" role="radiogroup">
          <label>
            <input type="radio" name="role" value="staff" defaultChecked />
            <span>Accueil</span>
          </label>
          <label>
            <input type="radio" name="role" value="owner" />
            <span>Gérant</span>
          </label>
        </div>
        <span className="hint">Accueil : valide les arrivées et marque les absents. Gérant : accès complet (rendement, créneaux, fiche, équipe).</span>
      </div>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.ok && <p className="notice notice-ok small" role="status">{state.message} Il reçoit un email pour se connecter.</p>}
      <button className="btn btn-primary" disabled={pending} style={{ alignSelf: 'flex-start' }}>{pending ? 'Ajout…' : 'Ajouter à l’équipe'}</button>
    </form>
  );
}
