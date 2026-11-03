'use server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { canCancel, getBooking } from '@/lib/bookings';

export async function cancelAction(form: FormData) {
  const id = String(form.get('bookingId'));
  const user = await requireUser(`/billets/${id}`);
  const row = await getBooking(id);
  if (!row || row.booking.userId !== user.id) return;
  if (!canCancel(row.booking.status, row.slot.startsAt)) return;
  await db
    .update(bookings)
    .set({ status: 'cancelled', cancelledAt: new Date() })
    .where(and(eq(bookings.id, id), eq(bookings.status, 'confirmed')));
  revalidatePath(`/billets/${id}`);
  revalidatePath('/billets');
}
