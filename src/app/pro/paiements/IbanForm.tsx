'use client';
import { useActionState, useEffect, useState } from 'react';
import { saveIbanAction, type IbanState } from './actions';

/** Titulaire et IBAN du compte qui reçoit les virements mensuels */
export function IbanForm({ holder, iban }: { holder: string; iban: string }) {
  const [state, action, pending] = useActionState<IbanState, FormData>(saveIbanAction, {});
  const [editing, setEditing] = useState(!iban);
  const saved = state.ok && !pending;
  // Enregistré : on revient à l'affichage du compte
  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state]);

  if (!editing && iban) {
    return (
      <div className="stack" style={{ ['--gap' as string]: '8px' }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span className="stack" style={{ ['--gap' as string]: '2px' }}>
            <b data-testid="iban">{iban}</b>
            <span className="small muted">{holder}</span>
          </span>
          <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>
            Modifier
          </button>
        </div>
        {saved && <p className="notice notice-ok" role="status">IBAN enregistré.</p>}
      </div>
    );
  }

  return (
    <form action={action} className="stack" style={{ ['--gap' as string]: '10px' }}>
      <label className="field">
        <span>Titulaire du compte</span>
        <input className="input" name="holder" required maxLength={70} defaultValue={state.holder ?? holder} autoComplete="organization" placeholder="Nom de la société ou du gérant" />
      </label>
      <label className="field">
        <span>IBAN</span>
        <input className="input" name="iban" required maxLength={42} defaultValue={state.iban ?? iban} autoComplete="off" spellCheck={false} placeholder="BE68 5390 0754 7034" style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.04em' }} />
      </label>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {saved && <p className="notice notice-ok" role="status">IBAN enregistré.</p>}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-primary" disabled={pending}>{pending ? 'Enregistrement…' : 'Enregistrer'}</button>
        {iban && (
          <button type="button" className="btn" onClick={() => setEditing(false)}>
            Annuler
          </button>
        )}
      </div>
      <p className="small muted">Si l’IBAN change, tous les gérants de l’établissement sont prévenus par email.</p>
    </form>
  );
}
