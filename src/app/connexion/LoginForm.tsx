'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { CodeStep } from '@/components/CodeStep';
import { loginAction, type LoginState } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { step: 'email', next });
  const signupHref = next.startsWith('/pro') ? '/inscription?type=exploitant' : `/inscription${next !== '/' ? `?suite=${encodeURIComponent(next)}` : ''}`;

  if (state.step === 'email') {
    return (
      <form action={action} className="stack" style={{ ['--gap' as string]: '14px' }}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="intent" value="send" />
        <label className="field">
          <span>Ton adresse email</span>
          <input className="input" type="email" name="email" required autoComplete="email" inputMode="email" defaultValue={state.email} placeholder="prenom@exemple.be" autoFocus />
        </label>
        {state.error && (
          <p className="error" role="alert">
            {state.error} {state.noAccount && <Link href={signupHref}>Créer un compte</Link>}
          </p>
        )}
        <button className="btn btn-primary btn-lg btn-block" disabled={pending}>
          {pending ? 'Envoi…' : 'Recevoir mon code'}
        </button>
        <p className="small muted">Pas de mot de passe : on t’envoie un code à 6 chiffres.</p>
        <p className="auth-switch">
          Pas encore de compte ? <Link href={signupHref}>Créer un compte</Link>
        </p>
      </form>
    );
  }

  return (
    <form action={action} className="stack" style={{ ['--gap' as string]: '14px' }}>
      <input type="hidden" name="next" value={next} />
      <CodeStep email={state.email} devCode={state.devCode} error={state.error} pending={pending} cta="Me connecter" />
    </form>
  );
}
