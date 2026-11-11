'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { bookAction, type BookState } from './actions';

export function BookForm({ slotId, people, total, needName, online, cancelHours }: { slotId: string; people: number; total: string; needName: boolean; online: boolean; cancelHours: number }) {
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
      <p className="small muted legal-line">
        Annulation gratuite jusqu’à {cancelHours} h avant, avec remboursement complet. S’agissant d’une activité de loisirs à date fixe, il n’y a pas de délai de rétractation de 14 jours. En
        payant, tu acceptes les <Link href="/conditions" target="_blank">conditions de réservation</Link>.
      </p>
      <button className="btn btn-dark btn-lg btn-block" disabled={pending} style={{ background: '#000', borderColor: '#000' }}>
        {pending ? (online ? 'Ouverture du paiement…' : 'Réservation…') : `Payer ${total}`}
      </button>
      {online ? (
        <div className="pay-methods">
          <span className="pay-badge bancontact">Bancontact</span>
          <span className="pay-badge">Carte</span>
          <span className="pay-badge">Apple Pay</span>
          <span className="pay-badge">Google Pay</span>
          <p className="small muted">Paiement sécurisé par Stripe. Tes places sont gardées 30 minutes le temps de payer.</p>
        </div>
      ) : (
        <p className="small muted" style={{ textAlign: 'center' }}>Paiement simulé pendant la phase de test : rien n’est débité.</p>
      )}
    </form>
  );
}
