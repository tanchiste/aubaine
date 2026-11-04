'use client';
import { useActionState, useEffect, useRef } from 'react';
import { checkInCodeAction, type CheckInState } from './checkin';

export function CheckInBox() {
  const [state, action, pending] = useActionState<CheckInState, FormData>(checkInCodeAction, {});
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state.ok && input.current) input.current.value = '';
  }, [state]);
  return (
    <form action={action} className="card stack" style={{ boxShadow: 'inset 0 0 0 2px #C9C3FF', ['--gap' as string]: '10px' }}>
      <label htmlFor="code" style={{ fontSize: 15, fontWeight: 800 }}>Valider une arrivée</label>
      <div className="row" style={{ ['--gap' as string]: '8px' }}>
        <input ref={input} id="code" name="code" className="input grow" placeholder="Code du billet" autoComplete="off" autoCapitalize="characters" maxLength={8} style={{ letterSpacing: '0.08em', fontWeight: 700, textTransform: 'uppercase' }} required />
        <button className="btn btn-primary" disabled={pending}>{pending ? '…' : 'Valider'}</button>
      </div>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.ok && <p className="notice notice-ok small" role="status">{state.message}</p>}
    </form>
  );
}
