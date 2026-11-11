'use server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { BookingError, createBooking } from '@/lib/bookings';
import { NotPayableError, paymentsEnabled, releasePending, sendConfirmation, slotPayable, startCheckout } from '@/lib/payments';

export type BookState = { error?: string };

export async function bookAction(_prev: BookState, form: FormData): Promise<BookState> {
  const slotId = String(form.get('slotId') ?? '');
  const people = parseInt(String(form.get('people') ?? ''), 10);
  const user = await requireUser(`/reserver?slot=${slotId}&n=${people}`);
  const firstName = String(form.get('firstName') ?? '').trim().slice(0, 40);
  if (!user.firstName && !firstName) return { error: 'Indique ton prénom : il s’affiche à l’accueil.' };
  if (!/^[0-9a-f-]{36}$/i.test(slotId) || !Number.isFinite(people)) return { error: 'Réservation invalide.' };
  const online = paymentsEnabled();
  if (online && !(await slotPayable(slotId))) return { error: new NotPayableError().message };

  let id: string;
  let payUrl: string | null = null;
  try {
    if (!user.firstName) await db.update(users).set({ firstName }).where(eq(users.id, user.id));
    // Paiement en ligne : les places sont tenues pendant le paiement Stripe. Sinon, paiement simulé (phase de test).
    const { booking } = await createBooking(user.id, slotId, people, { pay: online ? 'online' : 'simulated' });
    id = booking.id;
    if (online) {
      try {
        payUrl = await startCheckout(booking.id);
      } catch (e) {
        if (!(e instanceof NotPayableError)) console.error('[stripe] ouverture du paiement', e);
        await releasePending(booking.id);
        return { error: e instanceof NotPayableError ? e.message : 'Le paiement n’a pas pu s’ouvrir. Réessaie dans un instant.' };
      }
    } else {
      await sendConfirmation(booking.id);
    }
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    console.error(e);
    return { error: 'La réservation n’a pas abouti. Réessaie dans un instant.' };
  }
  if (payUrl) redirect(payUrl);
  revalidatePath('/billets');
  redirect(`/billets/${id}?nouveau=1`);
}
