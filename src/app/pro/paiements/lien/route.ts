import { NextResponse } from 'next/server';
import { onboardingUrl } from '@/lib/connect';
import { connectEnabled } from '@/lib/payments';
import { getProContext } from '@/lib/pro';
import { siteUrl } from '@/lib/site';

/**
 * Nouveau lien vers le formulaire Stripe, pour un compte déjà créé : bouton « Continuer sur Stripe »,
 * et adresse où Stripe renvoie quand un lien a expiré. Ne crée jamais de compte (lien GET).
 */
export async function GET() {
  const back = (q = '') => NextResponse.redirect(new URL(`/pro/paiements${q}`, siteUrl()));
  const { user, current, role } = await getProContext('/pro/paiements');
  if (!current || (role !== 'owner' && !user.isAdmin)) return NextResponse.redirect(new URL('/pro', siteUrl()));
  const account = current.venue.stripeAccountId;
  if (!connectEnabled() || !account) return back();
  try {
    return NextResponse.redirect(await onboardingUrl(account));
  } catch (e) {
    console.error('[stripe] lien d’inscription', e);
    return back('?erreur=1');
  }
}
