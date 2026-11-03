'use server';
import { redirect } from 'next/navigation';
import { requestLoginCode, verifyLoginCode } from '@/lib/auth';

export type LoginState = { step: 'email' | 'code'; email?: string; error?: string; devCode?: string; next?: string };

/** N'accepte que les redirections internes à l'app */
function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === 'string' ? v : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/';
}

export async function loginAction(prev: LoginState, form: FormData): Promise<LoginState> {
  const next = safeNext(form.get('next'));
  const intent = form.get('intent');

  if (intent === 'restart') return { step: 'email', next };

  if (intent === 'send' || prev.step === 'email') {
    const email = String(form.get('email') ?? '');
    const r = await requestLoginCode(email);
    if (!r.ok) return { step: 'email', email, error: r.error, next };
    return { step: 'code', email: email.trim().toLowerCase(), devCode: r.devCode, next };
  }

  const email = String(form.get('email') ?? prev.email ?? '');
  const r = await verifyLoginCode(email, String(form.get('code') ?? ''));
  if (!r.ok) return { ...prev, step: 'code', email, error: r.error, next };
  redirect(next);
}
