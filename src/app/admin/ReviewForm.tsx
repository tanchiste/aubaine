'use client';
import { useActionState } from 'react';
import { reviewAction, type AdminState } from './actions';

export function ReviewForm({ venueId, ready, ownerName, defaultMessage }: { venueId: string; ready: boolean; ownerName: string; defaultMessage: string }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(reviewAction, {});
  if (state.ok) return <p className="notice notice-ok" role="status">{state.message}</p>;
  return (
    <form action={action} className="stack" style={{ ['--gap' as string]: '12px' }}>
      <input type="hidden" name="venueId" value={venueId} />
      <label className="field">
        <span>Message à {ownerName}</span>
        <textarea className="textarea" name="message" defaultValue={defaultMessage} rows={3} placeholder="Obligatoire pour une correction ou un refus, facultatif pour une mise en ligne." />
      </label>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-primary" name="decision" value="approve" disabled={!ready || pending} title={ready ? undefined : 'Bloqué tant que la checklist n’est pas complète'}>
          Mettre en ligne
        </button>
        <button className={`btn${ready ? '' : ' btn-dark'}`} name="decision" value="changes" disabled={pending}>
          Demander une correction
        </button>
        <button className="btn btn-danger" name="decision" value="reject" disabled={pending} style={{ marginLeft: 'auto' }}>
          Refuser
        </button>
      </div>
    </form>
  );
}
