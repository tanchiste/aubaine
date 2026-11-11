'use client';
import { useActionState } from 'react';
import { REPORT_REASONS } from './reasons';
import { reportAction, type ReportState } from './actions';

export function ReportForm({ venue, venues, signedIn }: { venue?: string; venues: { slug: string; name: string }[]; signedIn: boolean }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(reportAction, {});
  if (state.ok) {
    return (
      <p className="notice notice-ok" role="status">
        Merci, ton signalement est enregistré. On l’examine et tu recevras notre décision motivée par email.
      </p>
    );
  }
  const v = state.values ?? {};
  return (
    <form action={action} className="card stack" style={{ ['--gap' as string]: '14px' }}>
      <label className="field">
        <span>Fiche concernée</span>
        <select className="select" name="venue" defaultValue={v.venue ?? venue ?? ''}>
          <option value="">Aucune en particulier</option>
          {venues.map((x) => (
            <option key={x.slug} value={x.slug}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Motif</span>
        <select className="select" name="reason" required defaultValue={v.reason ?? ''}>
          <option value="" disabled>
            Choisir…
          </option>
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Ce qui pose problème</span>
        <textarea className="textarea" name="details" required minLength={20} maxLength={2000} rows={5} defaultValue={v.details} placeholder="Où se trouve le contenu, et pourquoi il te semble illégal ou trompeur." />
      </label>
      {!signedIn && (
        <label className="field">
          <span>Ton email</span>
          <input className="input" type="email" name="email" required autoComplete="email" defaultValue={v.email} placeholder="Pour t’envoyer notre décision" />
        </label>
      )}
      <input type="text" name="site" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1 }} />
      <label className="check-row">
        <input type="checkbox" name="good" required />
        <span>Je signale de bonne foi : les informations données sont exactes et complètes.</span>
      </label>
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn btn-primary btn-block" disabled={pending}>
        {pending ? 'Envoi…' : 'Envoyer le signalement'}
      </button>
    </form>
  );
}
