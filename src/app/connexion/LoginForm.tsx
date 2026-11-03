'use client';
import { useActionState } from 'react';
import { loginAction, type LoginState } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { step: 'email', next });

  if (state.step === 'email') {
    return (
      <form action={action} className="stack" style={{ ['--gap' as string]: '14px' }}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="intent" value="send" />
        <label className="field">
          <span>Ton adresse email</span>
          <input className="input" type="email" name="email" required autoComplete="email" inputMode="email" defaultValue={state.email} placeholder="prenom@exemple.be" autoFocus />
        </label>
        {state.error && <p className="error" role="alert">{state.error}</p>}
        <button className="btn btn-primary btn-lg btn-block" disabled={pending}>
          {pending ? 'Envoi…' : 'Recevoir mon code'}
        </button>
        <p className="small muted">Pas de mot de passe : on t’envoie un code à 6 chiffres. Ton compte est créé automatiquement.</p>
      </form>
    );
  }

  return (
    <form action={action} className="stack" style={{ ['--gap' as string]: '14px' }}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="email" value={state.email} />
      <p style={{ color: 'var(--ink-2)' }}>
        Code envoyé à <b>{state.email}</b>. Il est valable 10 minutes.
      </p>
      {state.devCode && (
        <p className="notice notice-primary small" data-testid="dev-code">
          Mode développement : ton code est <b>{state.devCode}</b>
        </p>
      )}
      <label className="field">
        <span>Code à 6 chiffres</span>
        <input className="input code-input" name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} autoFocus />
      </label>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn btn-primary btn-lg btn-block" name="intent" value="verify" disabled={pending}>
        {pending ? 'Vérification…' : 'Me connecter'}
      </button>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn-sm" name="intent" value="send" formNoValidate disabled={pending}>
          Renvoyer un code
        </button>
        <button className="btn btn-sm" name="intent" value="restart" formNoValidate disabled={pending}>
          Changer d’email
        </button>
      </div>
    </form>
  );
}
