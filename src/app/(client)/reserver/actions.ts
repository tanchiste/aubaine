'use server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { BookingError, createBooking } from '@/lib/bookings';
import { sendMail } from '@/lib/email';
import { euros, longDate, brusselsDate, timeLabel } from '@/lib/format';

export type BookState = { error?: string };

export async function bookAction(_prev: BookState, form: FormData): Promise<BookState> {
  const slotId = String(form.get('slotId') ?? '');
  const people = parseInt(String(form.get('people') ?? ''), 10);
  const user = await requireUser(`/reserver?slot=${slotId}&n=${people}`);
  const firstName = String(form.get('firstName') ?? '').trim().slice(0, 40);
  if (!user.firstName && !firstName) return { error: 'Indique ton prénom : il s’affiche à l’accueil.' };
  if (!/^[0-9a-f-]{36}$/i.test(slotId) || !Number.isFinite(people)) return { error: 'Réservation invalide.' };

  let id: string;
  try {
    if (!user.firstName) await db.update(users).set({ firstName }).where(eq(users.id, user.id));
    // Paiement simulé pendant la phase de test : Stripe prendra sa place ici.
    const { booking, venue, slot } = await createBooking(user.id, slotId, people);
    id = booking.id;
    const app = process.env.APP_URL ?? 'http://localhost:3000';
    await sendMail({
      to: user.email,
      subject: `C'est réservé : ${venue.name} à ${timeLabel(slot.startsAt)}`,
      text: `${venue.name} t'attend ${longDate(brusselsDate(slot.startsAt))} à ${timeLabel(slot.startsAt)}, pour ${booking.people} pers.\nCode à montrer à l'accueil : ${booking.code}\nTotal : ${euros(booking.totalCents)}\n\nTon billet : ${app}/billets/${booking.id}\nAnnulation gratuite jusqu'à 2 h avant.`,
    }).catch(() => {});
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    console.error(e);
    return { error: 'La réservation n’a pas abouti. Réessaie dans un instant.' };
  }
  revalidatePath('/billets');
  redirect(`/billets/${id}?nouveau=1`);
}
