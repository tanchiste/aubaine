'use client';
import { useActionState, useState } from 'react';
import { deleteAccountAction, type DeleteState } from './actions';

/** Suppression du compte, en deux temps pour éviter un clic malheureux */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccountAction, {});
  if (!open) {
    return (
      <button type="button" className="btn btn-sm btn-danger" onClick={() => setOpen(true)}>
        Supprimer mon compte
      </button>
    );
  }
  return (
    <form action={action} className="stack danger-zone" style={{ ['--gap' as string]: '10px' }}>
      <p className="small" style={{ color: 'var(--ink-2)' }}>
        Ton prénom, ton email, ton téléphone et ta ville sont effacés, et tu es déconnecté. Tes réservations passées restent, sans lien avec toi, pour la comptabilité. Tes points sont perdus.
      </p>
      <label className="field">
        <span>Tape SUPPRIMER pour confirmer</span>
        <input className="input" name="confirm" autoComplete="off" autoCapitalize="characters" required />
      </label>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-sm" onClick={() => setOpen(false)} disabled={pending}>
          Garder mon compte
        </button>
        <button className="btn btn-sm btn-danger" disabled={pending}>
          {pending ? 'Suppression…' : 'Supprimer définitivement'}
        </button>
      </div>
    </form>
  );
}
