'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { CodeStep } from '@/components/CodeStep';
import { CATEGORIES, CATEGORY_KEYS } from '@/lib/categories';
import { signupAction, type SignupState } from './actions';

export function SignupForm({ kind, next }: { kind: 'client' | 'exploitant'; next: string }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(signupAction, { step: 'form', kind });
  const v = state.values ?? {};
  const loginHref = `/connexion${next !== '/' ? `?suite=${encodeURIComponent(next)}` : ''}`;

  return (
    <form action={action} className="stack" style={{ ['--gap' as string]: '14px' }}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="next" value={next} />
      {state.step === 'code' ? (
        <CodeStep email={state.email} devCode={state.devCode} error={state.error} pending={pending} cta="Créer mon compte" />
      ) : (
        <>
          <input type="hidden" name="intent" value="send" />
          <label className="field">
            <span>Prénom</span>
            <input className="input" name="firstName" required maxLength={40} autoComplete="given-name" defaultValue={v.firstName} autoFocus />
          </label>
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" name="email" required autoComplete="email" inputMode="email" placeholder="prenom@exemple.be" defaultValue={v.email} />
          </label>
          {kind === 'exploitant' && (
            <>
              <label className="field">
                <span>Nom de l’établissement</span>
                <input className="input" name="venueName" required minLength={2} maxLength={60} placeholder="Ex. Kart’Ohm" defaultValue={v.venueName} />
              </label>
              <div className="grid-2">
                <label className="field">
                  <span>Activité</span>
                  <select className="select" name="category" required defaultValue={v.category ?? ''}>
                    <option value="" disabled>Choisir…</option>
                    {CATEGORY_KEYS.map((k) => (
                      <option key={k} value={k}>{CATEGORIES[k].label}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Commune</span>
                  <input className="input" name="city" required maxLength={40} defaultValue={v.city ?? 'Mons'} />
                </label>
              </div>
            </>
          )}
          {state.error && (
            <p className="error" role="alert">
              {state.error} {state.exists && <Link href={loginHref}>Me connecter</Link>}
            </p>
          )}
          <button className="btn btn-primary btn-lg btn-block" disabled={pending}>
            {pending ? 'Envoi…' : 'Recevoir mon code'}
          </button>
          <p className="small muted">
            Pas de mot de passe : on t’envoie un code à 6 chiffres pour confirmer ton email. En créant un compte, tu acceptes les conditions d’utilisation d’Aubaine.
          </p>
          <p className="auth-switch">
            Déjà un compte ? <Link href={loginHref}>Me connecter</Link>
          </p>
        </>
      )}
    </form>
  );
}
