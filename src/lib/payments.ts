import 'server-only';
import Stripe from 'stripe';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { getBooking, HOLD_MINUTES } from './bookings';
import { bookingCancelledMail, bookingConfirmationMail, sendMail } from './email';
import { notifyVenueBooking } from './notify';
import { brusselsDate, capitalize, longDate, timeLabel } from './format';
import { COMMISSION_PCT } from './pricing';

/**
 * Paiement en ligne avec Stripe Checkout : Bancontact et carte (Apple Pay et Google Pay compris).
 * Sans STRIPE_SECRET_KEY, l'app garde le paiement simulé de la phase de test.
 * Les fonds arrivent sur le compte Stripe d'Aubaine ; la commission est figée sur chaque réservation (fee_cents).
 */
export const paymentsEnabled = () => !!process.env.STRIPE_SECRET_KEY;

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY manquant');
  if (!client) {
    // STRIPE_API_BASE ne sert qu'aux tests locaux (serveur stripe-mock).
    const base = process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null;
    client = new Stripe(process.env.STRIPE_SECRET_KEY, {
      maxNetworkRetries: 2,
      timeout: 20_000,
      appInfo: { name: 'Aubaine' },
      ...(base ? { host: base.hostname, port: base.port, protocol: base.protocol.replace(':', '') as 'http' | 'https' } : {}),
    });
  }
  return client;
}

const app = () => process.env.APP_URL ?? 'http://localhost:3000';

/** Ouvre la page de paiement Stripe pour une réservation en attente ; renvoie l'adresse où envoyer le client */
export async function startCheckout(bookingId: string): Promise<string> {
  const row = await getBooking(bookingId);
  if (!row || row.booking.status !== 'pending') throw new Error('Réservation introuvable');
  const { booking, slot, venue, offer, user } = row;
  const when = `${capitalize(longDate(brusselsDate(slot.startsAt)))} à ${timeLabel(slot.startsAt)}`;
  const session = await stripe().checkout.sessions.create(
    {
      mode: 'payment',
      currency: 'eur',
      locale: 'fr',
      // Bancontact et carte, parmi les moyens activés dans le tableau de bord Stripe
      allowed_payment_method_types: ['bancontact', 'card'],
      customer_email: user.email,
      client_reference_id: booking.id,
      metadata: { booking_id: booking.id, code: booking.code },
      payment_intent_data: { description: `${venue.name} · ${when} · ${booking.code}`, metadata: { booking_id: booking.id, venue_id: venue.id } },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: booking.totalCents,
            product_data: { name: `${venue.name} · ${offer.name}`, description: `${when}, ${booking.people} pers., remise heures creuses −${booking.discountPct} %` },
          },
        },
      ],
      // Stripe impose au moins 30 minutes ; les places restent tenues un peu plus longtemps (HOLD_MINUTES).
      expires_at: Math.floor(Date.now() / 1000) + Math.max(31, HOLD_MINUTES - 4) * 60,
      success_url: `${app()}/reserver/retour?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${app()}/reserver/retour?annule=${booking.id}`,
    },
    { idempotencyKey: `checkout-${booking.id}` },
  );
  await db.update(bookings).set({ stripeSessionId: session.id }).where(eq(bookings.id, booking.id));
  if (!session.url) throw new Error('Stripe n’a pas renvoyé de page de paiement');
  return session.url;
}

/** Le moyen réellement utilisé (bancontact, card…), lu sur le paiement */
async function methodOf(paymentIntent: string | Stripe.PaymentIntent | null): Promise<{ id: string | null; method: string | null }> {
  if (!paymentIntent) return { id: null, method: null };
  try {
    const pi = typeof paymentIntent === 'string' ? await stripe().paymentIntents.retrieve(paymentIntent, { expand: ['latest_charge'] }) : paymentIntent;
    const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
    return { id: pi.id, method: charge?.payment_method_details?.type ?? pi.payment_method_types?.[0] ?? null };
  } catch {
    return { id: typeof paymentIntent === 'string' ? paymentIntent : paymentIntent.id, method: null };
  }
}

/**
 * Une session payée confirme sa réservation, une seule fois (webhook et retour du client peuvent arriver ensemble).
 * Celui qui fait passer la réservation de « en attente » à « confirmée » envoie l'email de confirmation.
 */
export async function settleSession(session: Stripe.Checkout.Session): Promise<{ bookingId: string | null; status: 'confirmed' | 'waiting' | 'failed' }> {
  const bookingId = session.metadata?.booking_id ?? session.client_reference_id ?? null;
  if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId)) return { bookingId: null, status: 'failed' };
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    return { bookingId, status: session.status === 'expired' ? 'failed' : 'waiting' };
  }
  const { id: intent, method } = await methodOf(session.payment_intent);
  const [done] = await db
    .update(bookings)
    .set({
      status: 'confirmed',
      paidAt: new Date(),
      expiresAt: null,
      paymentMethod: method ?? 'card',
      stripePaymentIntent: intent,
      feeCents: Math.round(((session.amount_total ?? 0) * COMMISSION_PCT) / 100),
    })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'pending'), eq(bookings.stripeSessionId, session.id)))
    .returning({ id: bookings.id });
  if (done) {
    await sendConfirmation(bookingId);
    return { bookingId, status: 'confirmed' };
  }
  // Déjà confirmée par l'autre chemin, ou réservation abandonnée entre-temps : dans ce cas, on rembourse.
  const row = await getBooking(bookingId);
  if (row?.booking.status === 'confirmed' || row?.booking.status === 'checked_in') return { bookingId, status: 'confirmed' };
  if (row && intent) await refundPayment(intent, bookingId).catch((e) => console.error('[stripe] remboursement automatique', e));
  return { bookingId, status: 'failed' };
}

/** Retour du client depuis Stripe : on relit la session plutôt que d'attendre le webhook */
export async function settleSessionId(sessionId: string) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return { bookingId: null, status: 'failed' as const };
  const session = await stripe().checkout.sessions.retrieve(sessionId);
  return settleSession(session);
}

/** Paiement abandonné ou refusé : les places sont libérées tout de suite */
export async function releasePending(bookingId: string, sessionId?: string) {
  await db
    .update(bookings)
    .set({ status: 'cancelled', cancelledAt: new Date(), expiresAt: null, cancelledBy: 'system' })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'pending'), ...(sessionId ? [eq(bookings.stripeSessionId, sessionId)] : [])));
  if (sessionId) await stripe().checkout.sessions.expire(sessionId).catch(() => {});
}

async function refundPayment(paymentIntent: string, bookingId: string) {
  await stripe().refunds.create({ payment_intent: paymentIntent, metadata: { booking_id: bookingId } }, { idempotencyKey: `refund-${bookingId}` });
}

/** Annulation par le client : remboursement intégral si le paiement est passé par Stripe */
export async function refundBooking(bookingId: string): Promise<boolean> {
  const row = await getBooking(bookingId);
  if (!row?.booking.stripePaymentIntent) return false;
  await refundPayment(row.booking.stripePaymentIntent, bookingId);
  await db.update(bookings).set({ refundedAt: new Date() }).where(eq(bookings.id, bookingId));
  return true;
}

export async function sendConfirmation(bookingId: string) {
  const row = await getBooking(bookingId);
  if (!row) return;
  await sendMail(bookingConfirmationMail(row)).catch((e) => console.error('[email] confirmation', e));
  await notifyVenueBooking(bookingId, 'new');
}

export async function sendCancellation(bookingId: string, refunded: boolean) {
  const row = await getBooking(bookingId);
  if (row) await sendMail(bookingCancelledMail(row, refunded)).catch((e) => console.error('[email] annulation', e));
}
