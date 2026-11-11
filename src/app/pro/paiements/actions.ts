'use server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users, venueEvents, venueMembers, venues } from '@/db/schema';
import { dashboardUrl, ensureAccount, onboardingUrl } from '@/lib/connect';
import { ibanChangedMail, sendMail } from '@/lib/email';
import { formatIban, normalizeIban } from '@/lib/payouts';
import { connectEnabled } from '@/lib/payments';
import { getProContext } from '@/lib/pro';

async function ownerContext() {
  const ctx = await getProContext('/pro/paiements');
  if (!ctx.current || (ctx.role !== 'owner' && !ctx.user.isAdmin)) redirect('/pro');
  return { user: ctx.user, venue: ctx.current.venue };
}

/** Crée le compte Stripe de l'établissement si besoin, puis envoie le gérant sur le formulaire Stripe */
export async function connectAction() {
  const { user, venue } = await ownerContext();
  if (!connectEnabled()) redirect('/pro/paiements');
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

/** En cas d'erreur, les valeurs saisies sont renvoyées pour que le formulaire ne se vide pas */
export type IbanState = { ok?: boolean; error?: string; holder?: string; iban?: string };

/**
 * Compte qui reçoit les virements mensuels. Changement sensible : il est journalisé et
 * tous les gérants sont prévenus par email (un IBAN modifié à leur insu détournerait leurs virements).
 */
export async function saveIbanAction(_prev: IbanState, form: FormData): Promise<IbanState> {
  const { user, venue } = await ownerContext();
  const holder = String(form.get('holder') ?? '').trim().replace(/\s+/g, ' ').slice(0, 70);
  const typed = String(form.get('iban') ?? '').slice(0, 42);
  const iban = normalizeIban(typed);
  if (holder.length < 2) return { error: 'Indique le titulaire du compte (nom de la société ou du gérant).', holder, iban: typed };
  if (!iban) return { error: 'Cet IBAN n’est pas valide. Vérifie-le sur ta carte bancaire ou dans ton appli (ex. BE68 5390 0754 7034).', holder, iban: typed };
  if (iban === venue.payoutIban && holder === venue.payoutHolder) return { ok: true };
  const changed = !!venue.payoutIban && iban !== venue.payoutIban;
  await db.update(venues).set({ payoutHolder: holder, payoutIban: iban, updatedAt: new Date() }).where(eq(venues.id, venue.id));
  await db.insert(venueEvents).values({ venueId: venue.id, actorId: user.id, action: 'payout_iban', message: `${formatIban(iban).slice(0, 4)} … ${iban.slice(-4)}` });
  if (changed) {
    const owners = await db
      .select({ email: users.email })
      .from(venueMembers)
      .innerJoin(users, eq(users.id, venueMembers.userId))
      .where(and(eq(venueMembers.venueId, venue.id), eq(venueMembers.role, 'owner')));
    await Promise.allSettled(owners.map((o) => sendMail(ibanChangedMail(venue, iban, user.email, o.email))));
  }
  revalidatePath('/pro/paiements');
  revalidatePath('/pro/etablissement');
  return { ok: true };
}
