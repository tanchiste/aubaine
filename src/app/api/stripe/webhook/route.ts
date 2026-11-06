import type Stripe from 'stripe';
import { releasePending, settleSession, stripe } from '@/lib/payments';

/**
 * Webhook Stripe : confirme une réservation payée même si le client ferme la page avant de revenir,
 * et libère les places d'un paiement expiré ou refusé. La signature (STRIPE_WEBHOOK_SECRET) est toujours vérifiée.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return new Response('Paiements non configurés', { status: 503 });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, req.headers.get('stripe-signature') ?? '', secret);
  } catch {
    return new Response('Signature invalide', { status: 400 });
  }
  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await settleSession(event.data.object);
        break;
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const s = event.data.object;
        const id = s.metadata?.booking_id ?? s.client_reference_id;
        if (id && /^[0-9a-f-]{36}$/i.test(id)) await releasePending(id, s.id);
        break;
      }
    }
  } catch (e) {
    // Stripe renverra l'évènement plus tard : l'enregistrement est idempotent.
    console.error('[stripe] webhook', event.type, e);
    return new Response('Erreur, réessaie', { status: 500 });
  }
  return Response.json({ received: true });
}
