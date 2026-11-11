'use server';
import { redirect } from 'next/navigation';
import { dashboardUrl, ensureAccount, onboardingUrl } from '@/lib/connect';
import { paymentsEnabled } from '@/lib/payments';
import { getProContext } from '@/lib/pro';

async function ownerContext() {
  const ctx = await getProContext('/pro/paiements');
  if (!ctx.current || (ctx.role !== 'owner' && !ctx.user.isAdmin)) redirect('/pro');
  return { user: ctx.user, venue: ctx.current.venue };
}

/** Crée le compte Stripe de l'établissement si besoin, puis envoie le gérant sur le formulaire Stripe */
export async function connectAction() {
  const { user, venue } = await ownerContext();
  if (!paymentsEnabled()) redirect('/pro/paiements');
  let url: string;
  try {
    const account = await ensureAccount(venue, user.email);
    url = await onboardingUrl(account);
  } catch (e) {
    console.error('[stripe] inscription exploitant', e);
    redirect('/pro/paiements?erreur=1');
  }
  redirect(url);
}

/** Espace Stripe de l'exploitant (versements, relevés, IBAN), disponible une fois le formulaire envoyé */
export async function dashboardAction() {
  const { venue } = await ownerContext();
  if (!venue.stripeAccountId) redirect('/pro/paiements');
  let url: string;
  try {
    url = await dashboardUrl(venue.stripeAccountId);
  } catch (e) {
    console.error('[stripe] espace exploitant', e);
    redirect('/pro/paiements?erreur=1');
  }
  redirect(url);
}
