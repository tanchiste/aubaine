import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getBooking } from '@/lib/bookings';
import { paymentsEnabled, releasePending, settleSessionId } from '@/lib/payments';

/** Retour depuis la page de paiement Stripe : billet si c'est payé, sinon retour au récapitulatif */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = (path: string) => NextResponse.redirect(new URL(path, process.env.APP_URL ?? url.origin));
  if (!paymentsEnabled()) return to('/billets');

  const cancelled = url.searchParams.get('annule');
  if (cancelled) {
    const [user, row] = await Promise.all([getCurrentUser(), getBooking(cancelled)]);
    if (!row) return to('/');
    if (user?.id === row.booking.userId && row.booking.status === 'pending') await releasePending(row.booking.id, row.booking.stripeSessionId ?? undefined);
    return to(`/reserver?slot=${row.slot.id}&n=${row.booking.people}&paiement=annule`);
  }

  const sessionId = url.searchParams.get('session_id') ?? '';
  try {
    const r = await settleSessionId(sessionId);
    if (!r.bookingId) return to('/billets');
    if (r.status === 'confirmed') return to(`/billets/${r.bookingId}?nouveau=1`);
    if (r.status === 'waiting') return to(`/billets/${r.bookingId}`);
    const row = await getBooking(r.bookingId);
    return to(row ? `/reserver?slot=${row.slot.id}&n=${row.booking.people}&paiement=echec` : '/');
  } catch (e) {
    console.error('[stripe] retour', e);
    return to('/billets');
  }
}
