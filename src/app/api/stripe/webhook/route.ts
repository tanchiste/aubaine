import type Stripe from 'stripe';
import { syncAccount } from '@/lib/connect';
import { releasePending, settleSession, stripe } from '@/lib/payments';

/**
 * Webhook Stripe : confirme une réservation payée même si le client ferme la page avant de revenir,
 * libère les places d'un paiement expiré ou refusé, et suit l'état des comptes Stripe des établissements.
 * La signature est toujours vérifiée : STRIPE_WEBHOOK_SECRET (évènements du compte Aubaine) et
 * STRIPE_CONNECT_WEBHOOK_SECRET (évènements des comptes connectés), les deux pouvant pointer ici.
 */
export async function POST(req: Request) {
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter((s): s is string => !!s);
  if (!secrets.length || !process.env.STRIPE_SECRET_KEY) return new Response('Paiements non configurés', { status: 503 });
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') ?? '';
  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = stripe().webhooks.constructEvent(body, signature, secret);
      break;
    } catch {
      // essaie le secret suivant
    }
  }
  if (!event) return new Response('Signature invalide', { status: 400 });
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
      case 'account.updated':
        // Formulaire terminé, vérification réussie, informations manquantes, Bancontact activé…
        await syncAccount(event.data.object);
        break;
    }
  } catch (e) {
    // Stripe renverra l'évènement plus tard : l'enregistrement est idempotent.
    console.error('[stripe] webhook', event.type, e);
    return new Response('Erreur, réessaie', { status: 500 });
  }
  return Response.json({ received: true });
}
