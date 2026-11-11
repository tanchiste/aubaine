'use client';
import { useActionState } from 'react';
import { decideReportAction, type DecideState } from './actions';

export function DecideForm({ reportId, canPause }: { reportId: string; canPause: boolean }) {
  const [state, action, pending] = useActionState<DecideState, FormData>(decideReportAction, {});
  if (state.ok) return <p className="notice notice-ok small" role="status">Décision enregistrée et envoyée.</p>;
  return (
    <form action={action} className="stack" style={{ ['--gap' as string]: '10px' }}>
      <input type="hidden" name="reportId" value={reportId} />
      <label className="field">
        <span>Décision et motifs (envoyés à la personne qui a signalé)</span>
        <textarea className="textarea" name="resolution" rows={3} required minLength={10} maxLength={1000} placeholder="Ex. Le prix normal a été corrigé avec l’exploitant. Merci !" />
      </label>
      {canPause && (
        <label className="check-row">
          <input type="checkbox" name="pause" />
          <span>Mettre la fiche en pause (l’exploitant reçoit les mêmes motifs)</span>
        </label>
      )}
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-sm" name="decision" value="dismissed" disabled={pending}>
          Rejeter
        </button>
        <button className="btn btn-sm btn-primary" name="decision" value="resolved" disabled={pending}>
          Traité
        </button>
      </div>
    </form>
  );
}
