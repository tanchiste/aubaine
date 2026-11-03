'use client';
import { useActionState } from 'react';
import { bookAction, type BookState } from './actions';

export function BookForm({ slotId, people, total, needName }: { slotId: string; people: number; total: string; needName: boolean }) {
  const [state, action, pending] = useActionState<BookState, FormData>(bookAction, {});
  return (
    <form action={action} className="stack" style={{ ['--gap' as string]: '12px' }}>
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="people" value={people} />
      {needName && (
        <label className="field">
          <span>Ton prénom</span>
          <input className="input" name="firstName" required maxLength={40} autoComplete="given-name" placeholder="Affiché à l’accueil" />
        </label>
      )}
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn btn-dark btn-lg btn-block" disabled={pending} style={{ background: '#000', borderColor: '#000' }}>
        {pending ? 'Réservation…' : `Payer ${total}`}
      </button>
      <p className="small muted" style={{ textAlign: 'center' }}>Paiement simulé pendant la phase de test : rien n’est débité.</p>
    </form>
  );
}
