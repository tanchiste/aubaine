'use server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db';
import { getBooking, holdsPlace } from '@/lib/bookings';
import { bookings, offers, slots, venueEvents } from '@/db/schema';
import { bookingCancelledByVenueMail, sendMail } from '@/lib/email';
import { refundBooking } from '@/lib/payments';
import { getMyVenues, requireUser } from '@/lib/auth';
import { MAX_DISCOUNT, MIN_DISCOUNT } from '@/lib/pricing';

export type SlotFormState = { ok?: boolean; error?: string; message?: string };

/** Nos messages restent lisibles, les erreurs techniques (SQL…) ne sont jamais montrées */
function friendly(e: unknown, fallback: string) {
  const msg = e instanceof Error ? e.message : '';
  if (/unique|duplicate/i.test(msg)) return 'Un créneau existe déjà à cette heure pour cette prestation.';
  if (!msg || /failed query|syntax|relation|column|violates/i.test(msg)) return fallback;
  return msg;
}

async function ownVenue(venueId: string) {
  const user = await requireUser('/pro/creneaux');
  const mine = await getMyVenues(user.id);
  const m = mine.find((x) => x.venue.id === venueId);
  if (!m) throw new Error('Établissement introuvable.');
  if (m.role !== 'owner') throw new Error('Réservé au gérant de l’établissement.');
  return m.venue;
}

const createSchema = z.object({
  venueId: z.uuid(),
  offerId: z.uuid({ message: 'Choisis une prestation.' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide.'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide.'),
  discountPct: z.coerce.number().int().min(MIN_DISCOUNT, `Remise minimum −${MIN_DISCOUNT} %.`).max(MAX_DISCOUNT, `Remise maximum −${MAX_DISCOUNT} %.`),
  capacity: z.coerce.number().int().min(1, 'Au moins 1 place.').max(200),
  weeks: z.coerce.number().int().min(1).max(12).default(1),
});

/** Ouvre un créneau, ou le même horaire les jours cochés pendant N semaines */
export async function createSlotsAction(_prev: SlotFormState, form: FormData): Promise<SlotFormState> {
  try {
    const parsed = createSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const d = parsed.data;
    const venue = await ownVenue(d.venueId);
    const [offer] = await db.select().from(offers).where(and(eq(offers.id, d.offerId), eq(offers.venueId, venue.id)));
    if (!offer) return { error: 'Prestation introuvable.' };
    if (offer.priceCents <= 0) return { error: 'Indique d’abord le prix de cette prestation (onglet Établissement).' };
    const days = form.getAll('dow').map(Number).filter((n) => n >= 1 && n <= 7);
    const span = days.length ? d.weeks * 7 - 1 : 0;
    const res = await db.execute<{ id: string }>(sql`
      insert into slots (venue_id, offer_id, starts_at, capacity, discount_pct)
      select ${venue.id}, ${offer.id}, (day::date + ${d.time}::time) at time zone 'Europe/Brussels', ${d.capacity}, ${d.discountPct}
      from generate_series(${d.date}::date, ${d.date}::date + ${span}::int, interval '1 day') as day
      where ((day::date + ${d.time}::time) at time zone 'Europe/Brussels') > now()
        ${days.length ? sql`and extract(isodow from day) in (${sql.join(days.map((n) => sql`${n}`), sql`, `)})` : sql``}
      on conflict (offer_id, starts_at) do nothing
      returning id`);
    const n = [...res].length;
    revalidatePath('/pro', 'layout');
    revalidatePath('/');
    if (n === 0) return { error: 'Aucun créneau ouvert : horaire déjà passé ou déjà ouvert.' };
    return { ok: true, message: `${n} créneau${n > 1 ? 'x' : ''} ouvert${n > 1 ? 's' : ''}.` };
  } catch (e) {
    console.error(e);
    return { error: friendly(e, 'Les créneaux n’ont pas pu être ouverts. Réessaie.') };
  }
}

async function ownSlot(slotId: string) {
  if (!z.uuid().safeParse(slotId).success) throw new Error('Créneau introuvable.');
  const [row] = await db
    .select({ slot: slots, offer: offers })
    .from(slots)
    .innerJoin(offers, eq(offers.id, slots.offerId))
    .where(eq(slots.id, slotId));
  if (!row) throw new Error('Créneau introuvable.');
  await ownVenue(row.slot.venueId);
  const [{ used, n }] = await db
    .select({
      used: sql<number>`coalesce(sum(case when ${row.offer.capacityUnit} = 'places' then ${bookings.people} else 1 end), 0)::int`,
      n: sql<number>`count(*)::int`,
    })
    .from(bookings)
    .where(and(eq(bookings.slotId, slotId), holdsPlace()));
  return { ...row, used, bookings: n };
}

const updateSchema = z.object({
  slotId: z.uuid(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide.').optional(),
  discountPct: z.coerce.number().int().min(MIN_DISCOUNT, `Remise minimum −${MIN_DISCOUNT} %.`).max(MAX_DISCOUNT, `Remise maximum −${MAX_DISCOUNT} %.`),
  capacity: z.coerce.number().int().min(1).max(200),
});

/** Modifier un créneau : remise, places, et l'heure tant que personne n'a réservé */
export async function updateSlotAction(_prev: SlotFormState, form: FormData): Promise<SlotFormState> {
  try {
    const parsed = updateSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const d = parsed.data;
    const { slot, used, bookings: nb } = await ownSlot(d.slotId);
    if (d.capacity < used) return { error: `Impossible de descendre sous ${used} : c’est déjà réservé.` };
    const patch: Record<string, unknown> = { discountPct: d.discountPct, capacity: d.capacity };
    if (d.time) {
      const [{ target }] = [
        ...(await db.execute<{ target: Date }>(
          sql`select ((${slot.startsAt.toISOString()}::timestamptz at time zone 'Europe/Brussels')::date + ${d.time}::time) at time zone 'Europe/Brussels' as target`,
        )),
      ];
      const when = new Date(target);
      const moved = when.getTime() !== slot.startsAt.getTime();
      if (moved && nb > 0) return { error: 'L’heure ne peut plus changer : des clients ont déjà réservé.' };
      if (moved && when.getTime() <= Date.now()) return { error: 'Cette heure est déjà passée.' };
      if (moved) patch.startsAt = when;
    }
    await db.update(slots).set(patch).where(eq(slots.id, slot.id));
    revalidatePath('/pro', 'layout');
    revalidatePath('/');
    return { ok: true, message: 'Créneau mis à jour.' };
  } catch (e) {
    console.error(e);
    return { error: friendly(e, 'Le créneau n’a pas pu être modifié. Réessaie.') };
  }
}

/** Fermer : le créneau disparaît de l'app, les réservations déjà prises restent valables */
export async function toggleSlotAction(form: FormData) {
  const { slot } = await ownSlot(String(form.get('slotId')));
  await db.update(slots).set({ isOpen: !slot.isOpen }).where(eq(slots.id, slot.id));
  revalidatePath('/pro', 'layout');
  revalidatePath('/');
}

/** Supprimer n'est possible que sans réservation */
export async function deleteSlotAction(form: FormData) {
  const { slot, bookings: nb } = await ownSlot(String(form.get('slotId')));
  if (nb > 0) return;
  await db.delete(bookings).where(eq(bookings.slotId, slot.id));
  await db.delete(slots).where(eq(slots.id, slot.id));
  revalidatePath('/pro', 'layout');
  revalidatePath('/');
  const back = String(form.get('back') ?? '');
  redirect(/^\/pro\/creneaux(\?[\w=&%-]*)?$/.test(back) ? back : '/pro/creneaux');
}

/**
 * Annulation par l'établissement (panne, fermeture, sécurité) : le client est remboursé en entier,
 * prévenu avec le motif, et aucune commission n'est due.
 */
export async function cancelByVenueAction(_prev: SlotFormState, form: FormData): Promise<SlotFormState> {
  try {
    const id = String(form.get('bookingId') ?? '');
    const reason = String(form.get('reason') ?? '').trim().slice(0, 300);
    if (reason.length < 5) return { error: 'Indique le motif au client (5 caractères minimum).' };
    const row = await getBooking(id);
    if (!row) return { error: 'Réservation introuvable.' };
    const venue = await ownVenue(row.venue.id);
    const user = await requireUser('/pro/creneaux');
    if (row.booking.status !== 'confirmed') return { error: 'Cette réservation ne peut plus être annulée.' };
    if (row.slot.startsAt.getTime() < Date.now() - 3 * 3_600_000) return { error: 'Ce créneau est passé.' };
    let refunded = false;
    if (row.booking.stripePaymentIntent) {
      try {
        refunded = await refundBooking(id);
      } catch (e) {
        console.error('[stripe] remboursement exploitant', e);
        return { error: 'Le remboursement n’a pas pu partir : la réservation reste valable. Réessaie dans un instant.' };
      }
    }
    const [done] = await db
      .update(bookings)
      .set({ status: 'cancelled', cancelledAt: new Date(), cancelledBy: 'venue', cancelReason: reason, feeCents: 0 })
      .where(and(eq(bookings.id, id), eq(bookings.status, 'confirmed')))
      .returning({ id: bookings.id });
    if (!done) return { error: 'Cette réservation ne peut plus être annulée.' };
    await db.insert(venueEvents).values({ venueId: venue.id, actorId: user.id, action: 'booking_cancelled', message: `${row.booking.code} : ${reason}` });
    await sendMail(bookingCancelledByVenueMail(row, reason, refunded)).catch((e) => console.error('[email] annulation exploitant', e));
    revalidatePath('/pro', 'layout');
    revalidatePath('/billets');
    return { ok: true, message: `Réservation de ${row.user.firstName ?? 'ce client'} annulée : remboursé${refunded ? '' : ' (rien n’avait été débité)'} et prévenu par email.` };
  } catch (e) {
    console.error(e);
    return { error: friendly(e, 'L’annulation n’a pas abouti. Réessaie.') };
  }
}
