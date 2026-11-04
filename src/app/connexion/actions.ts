'use server';
import { redirect } from 'next/navigation';
import { requestLoginCode, verifyLoginCode } from '@/lib/auth';

export type LoginState = { step: 'email' | 'code'; email?: string; error?: string; noAccount?: boolean; devCode?: string; next?: string };

/** N'accepte que les redirections internes à l'app */
export async function safeNext(v: FormDataEntryValue | null | undefined): Promise<string> {
  const s = typeof v === 'string' ? v : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/';
}

/** Où aller après la connexion : la page demandée, sinon l'espace qui correspond au type de compte */
export async function homeFor(kind: 'client' | 'exploitant', next: string): Promise<string> {
  if (next !== '/') return next;
  return kind === 'exploitant' ? '/pro' : '/';
}

export async function loginAction(prev: LoginState, form: FormData): Promise<LoginState> {
  const next = await safeNext(form.get('next'));
  const intent = form.get('intent');

  if (intent === 'restart') return { step: 'email', next };

  if (intent === 'send') {
    const email = String(form.get('email') ?? '');
    const r = await requestLoginCode(email);
    if (!r.ok) return { step: 'email', email, error: r.error, noAccount: r.reason === 'no_account', next };
    return { step: 'code', email: email.trim().toLowerCase(), devCode: r.devCode, next };
  }

  const email = String(form.get('email') ?? prev.email ?? '');
  const r = await verifyLoginCode(email, String(form.get('code') ?? ''));
  if (!r.ok) return { ...prev, step: 'code', email, error: r.error, next };
  redirect(await homeFor(r.user.kind, next));
}
