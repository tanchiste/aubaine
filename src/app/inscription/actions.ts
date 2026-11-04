'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { VenueCategory } from '@/db/schema';
import { requestLoginCode, verifyLoginCode, type SignupPayload } from '@/lib/auth';
import { CATEGORY_KEYS } from '@/lib/categories';
import { VENUE_COOKIE, createDraftVenue } from '@/lib/pro';
import { homeFor, safeNext } from '../connexion/actions';

export type SignupState = {
  step: 'form' | 'code';
  kind: 'client' | 'exploitant';
  values?: Record<string, string>;
  email?: string;
  error?: string;
  exists?: boolean;
  devCode?: string;
};

const base = z.object({
  firstName: z.string().trim().min(1, 'Indique ton prénom.').max(40),
  email: z.string().trim().min(3, 'Indique ton email.'),
});
const pro = base.extend({
  venueName: z.string().trim().min(2, 'Indique le nom de ton établissement.').max(60),
  category: z.enum(CATEGORY_KEYS as [VenueCategory, ...VenueCategory[]], { message: 'Choisis ton activité.' }),
  city: z.string().trim().min(2, 'Indique la commune.').max(40),
});

export async function signupAction(prev: SignupState, form: FormData): Promise<SignupState> {
  const kind = form.get('kind') === 'exploitant' ? 'exploitant' : 'client';
  const next = await safeNext(form.get('next'));
  const intent = form.get('intent');
  const values = Object.fromEntries([...form.entries()].filter(([k]) => typeof form.get(k) === 'string').map(([k, v]) => [k, String(v)]));

  if (intent === 'restart') return { step: 'form', kind, values: prev.values };

  if (intent === 'send') {
    // « Renvoyer un code » depuis l'étape du code : on réutilise les valeurs déjà saisies.
    const data = prev.step === 'code' && prev.values ? prev.values : values;
    const parsed = (kind === 'exploitant' ? pro : base).safeParse(data);
    if (!parsed.success) return { step: 'form', kind, values: data, error: parsed.error.issues[0].message };
    const d = parsed.data as z.infer<typeof pro>;
    const payload: SignupPayload = {
      kind,
      firstName: d.firstName,
      venue: kind === 'exploitant' ? { name: d.venueName, category: d.category, city: d.city } : undefined,
    };
    const r = await requestLoginCode(d.email, payload);
    if (!r.ok) return { step: 'form', kind, values: data, error: r.error, exists: r.reason === 'exists' };
    return { step: 'code', kind, values: data, email: d.email.trim().toLowerCase(), devCode: r.devCode };
  }

  const email = String(form.get('email') ?? prev.email ?? '');
  const r = await verifyLoginCode(email, String(form.get('code') ?? ''));
  if (!r.ok) return { ...prev, step: 'code', error: r.error };

  if (r.created && r.signup?.venue) {
    const venueId = await createDraftVenue(r.user.id, r.signup.venue);
    (await cookies()).set(VENUE_COOKIE, venueId, { path: '/', sameSite: 'lax', httpOnly: true, maxAge: 31536000 });
    redirect('/pro/etablissement?nouveau=1');
  }
  redirect(await homeFor(r.user.kind, next));
}
