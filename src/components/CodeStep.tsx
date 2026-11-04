/** Saisie du code reçu par email, commune à la connexion et à l'inscription */
export function CodeStep({ email, devCode, error, pending, cta }: { email?: string; devCode?: string; error?: string; pending: boolean; cta: string }) {
  return (
    <>
      <input type="hidden" name="email" value={email} />
      <p style={{ color: 'var(--ink-2)' }}>
        Code envoyé à <b>{email}</b>. Il est valable 10 minutes.
      </p>
      {devCode && (
        <p className="notice notice-primary small" data-testid="dev-code">
          Version de test : ton code est <b>{devCode}</b>
        </p>
      )}
      <label className="field">
        <span>Code à 6 chiffres</span>
        <input className="input code-input" name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} autoFocus />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-lg btn-block" name="intent" value="verify" disabled={pending}>
        {pending ? 'Vérification…' : cta}
      </button>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn-sm" name="intent" value="send" formNoValidate disabled={pending}>Renvoyer un code</button>
        <button className="btn btn-sm" name="intent" value="restart" formNoValidate disabled={pending}>Changer d’email</button>
      </div>
    </>
  );
}
