import 'server-only';
import type Stripe from 'stripe';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { venues, type Venue } from '@/db/schema';
import { paymentsEnabled, stripe } from './payments';
import { siteUrl } from './site';

/**
 * Stripe Connect : chaque établissement a son propre compte Stripe (type Express).
 * Le client paie l'exploitant directement ; Aubaine prélève sa commission au passage et paie les frais Stripe.
 * Aubaine ne détient donc jamais l'argent des clients pour le compte des exploitants.
 */

type StripeFields = Pick<Venue, 'stripeAccountId' | 'stripeChargesEnabled' | 'stripePayoutsEnabled' | 'stripeBancontact' | 'stripeDetailsSubmitted'>;

/**
 * off : paiements en ligne pas encore ouverts sur Aubaine (paiement simulé)
 * none : rien n'est commencé ; incomplete : formulaire Stripe à terminer ; review : Stripe vérifie ; ready : encaissement possible
 */
export type PaymentState = 'off' | 'none' | 'incomplete' | 'review' | 'ready';

export function paymentState(v: StripeFields): PaymentState {
  if (!paymentsEnabled()) return 'off';
  if (!v.stripeAccountId) return 'none';
  if (v.stripeChargesEnabled) return 'ready';
  return v.stripeDetailsSubmitted ? 'review' : 'incomplete';
}

/** L'établissement peut-il être payé en ligne ? (toujours vrai en paiement simulé) */
export const acceptsPayments = (v: StripeFields) => !paymentsEnabled() || (!!v.stripeAccountId && v.stripeChargesEnabled);

/** Crée le compte Stripe de l'établissement s'il n'existe pas encore ; renvoie son identifiant */
export async function ensureAccount(venue: Venue, email: string): Promise<string> {
  if (venue.stripeAccountId) return venue.stripeAccountId;
  const site = siteUrl();
  const account = await stripe().accounts.create(
    {
      country: 'BE',
      email,
      // Équivalent d'un compte Express : Stripe collecte les informations et vérifie l'identité,
      // l'exploitant a un espace Stripe simplifié, Aubaine paie les frais et répond des pertes.
      controller: {
        fees: { payer: 'application' },
        losses: { payments: 'application' },
        requirement_collection: 'stripe',
        stripe_dashboard: { type: 'express' },
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
        bancontact_payments: { requested: true },
      },
      business_profile: {
        name: venue.name,
        mcc: '7999', // Loisirs et divertissements
        product_description: 'Activités de loisirs réservées en ligne via Aubaine',
        // Stripe refuse les adresses locales : seulement en production
        ...(site.startsWith('https://') ? { url: `${site}/lieu/${venue.slug}` } : {}),
      },
      settings: { payouts: { schedule: { interval: 'weekly', weekly_anchor: 'monday' } } },
      metadata: { venue_id: venue.id },
    },
    // Deux clics rapprochés ne créent qu'un seul compte
    { idempotencyKey: `account-${venue.id}` },
  );
  const [saved] = await db
    .update(venues)
    .set({ stripeAccountId: account.id, stripeCheckedAt: new Date() })
    .where(and(eq(venues.id, venue.id), isNull(venues.stripeAccountId)))
    .returning({ id: venues.stripeAccountId });
  if (saved?.id) return saved.id;
  const [row] = await db.select({ id: venues.stripeAccountId }).from(venues).where(eq(venues.id, venue.id));
  return row?.id ?? account.id;
}

/** Lien à usage unique vers le formulaire Stripe (identité, entreprise, IBAN) */
export async function onboardingUrl(accountId: string): Promise<string> {
  const site = siteUrl();
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    // Lien expiré ou déjà utilisé : Stripe renvoie ici, qui en crée un nouveau
    refresh_url: `${site}/pro/paiements/lien`,
    return_url: `${site}/pro/paiements?retour=1`,
    collection_options: { fields: 'eventually_due' },
  });
  return link.url;
}

/** Espace Stripe de l'exploitant : versements, relevés, coordonnées bancaires */
export async function dashboardUrl(accountId: string): Promise<string> {
  return (await stripe().accounts.createLoginLink(accountId)).url;
}

const fieldsOf = (account: Stripe.Account): Omit<StripeFields, 'stripeAccountId'> => {
  const caps = account.capabilities ?? {};
  return {
    stripeChargesEnabled: !!account.charges_enabled && caps.card_payments === 'active' && caps.transfers === 'active',
    stripePayoutsEnabled: !!account.payouts_enabled,
    stripeBancontact: caps.bancontact_payments === 'active',
    stripeDetailsSubmitted: !!account.details_submitted,
  };
};

/** Recopie l'état du compte Stripe sur l'établissement (webhook account.updated, retour du formulaire) */
export async function syncAccount(account: Stripe.Account) {
  const fields = fieldsOf(account);
  await db.update(venues).set({ ...fields, stripeCheckedAt: new Date() }).where(eq(venues.stripeAccountId, account.id));
  return fields;
}

export async function refreshAccount(accountId: string) {
  return syncAccount(await stripe().accounts.retrieve(accountId));
}
