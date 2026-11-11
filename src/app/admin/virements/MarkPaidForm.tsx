'use client';
import { useActionState } from 'react';
import { markPaidAction, type PayoutState } from './actions';

/** À cliquer une fois le virement fait depuis la banque d'Aubaine */
export function MarkPaidForm({ venueId, month, reference, amount }: { venueId: string; month: string; reference: string; amount: string }) {
  const [state, action, pending] = useActionState<PayoutState, FormData>(markPaidAction, {});
  if (state.ok) return <span className="pill pill-ok">Enregistré</span>;
  return (
    <form action={action} className="stack" style={{ ['--gap' as string]: '6px', minWidth: 190 }}>
      <input type="hidden" name="venueId" value={venueId} />
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="reference" value={reference} />
      <button className="btn btn-sm btn-primary" disabled={pending} title={`Confirme que ${amount} ont été virés`}>
        {pending ? 'Enregistrement…' : 'Marquer comme versé'}
      </button>
      {state.error && (
        <span className="error small" role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}
