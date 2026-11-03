'use client';
import { useActionState } from 'react';
import { submitVenueAction, type FormState } from '../actions';

export function SubmitBox({ venueId, ready, children }: { venueId: string; ready: boolean; children: React.ReactNode }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitVenueAction, {});
  return (
    <section className="card stack" aria-labelledby="f-submit" style={{ boxShadow: 'inset 0 0 0 2px #C9C3FF' }}>
      <h2 id="f-submit" style={{ fontSize: 15, fontWeight: 800 }}>Mise en ligne</h2>
      {children}
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.ok ? (
        <p className="notice notice-ok">{state.message}</p>
      ) : (
        <form action={action}>
          <input type="hidden" name="venueId" value={venueId} />
          <button className="btn btn-primary btn-block" disabled={!ready || pending}>
            {pending ? 'Envoi…' : ready ? 'Envoyer ma fiche en validation' : 'Complète la liste pour envoyer'}
          </button>
        </form>
      )}
      <p className="small muted">Pense à enregistrer la fiche avant de l’envoyer. On vérifie chaque fiche à la main, sous 24 h.</p>
    </section>
  );
}
