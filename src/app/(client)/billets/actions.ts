'use server';
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { canCancel, getBooking } from '@/lib/bookings';
import { notifyVenueBooking } from '@/lib/notify';
import { refundBooking, sendCancellation } from '@/lib/payments';

export async function cancelAction(form: FormData) {
  const id = String(form.get('bookingId'));
  const user = await requireUser(`/billets/${id}`);
  const row = await getBooking(id);
  if (!row || row.booking.userId !== user.id) return;
  if (!canCancel(row.booking.status, row.slot.startsAt)) return;
  // Payée en ligne : on rembourse d'abord. Si Stripe refuse, la réservation reste valable.
  let refunded = false;
  if (row.booking.stripePaymentIntent) {
    try {
      refunded = await refundBooking(id);
    } catch (e) {
      console.error('[stripe] remboursement', e);
      redirect(`/billets/${id}?erreur=remboursement`);
    }
  }
  const [done] = await db
    .update(bookings)
    .set({ status: 'cancelled', cancelledAt: new Date(), cancelledBy: 'client', feeCents: 0 })
    .where(and(eq(bookings.id, id), eq(bookings.status, 'confirmed')))
    .returning({ id: bookings.id });
  if (done) {
    await sendCancellation(id, refunded);
    await notifyVenueBooking(id, 'cancelled');
  }
  revalidatePath(`/billets/${id}`);
  revalidatePath('/billets');
}
