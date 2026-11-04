'use server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db';
import { bookings, slots } from '@/db/schema';
import { getMyVenues, requireUser } from '@/lib/auth';
import { MAX_DISCOUNT, MIN_DISCOUNT } from '@/lib/pricing';

export type SlotFormState = { ok?: boolean; error?: string; message?: string };

async function ownVenue(venueId: string) {
  const user = await requireUser('/pro/creneaux');
  const mine = await getMyVenues(user.id);
  const m = mine.find((x) => x.venue.id === venueId);
  if (!m) throw new Error('Établissement introuvable.');
  if (m.role !== 'owner') throw new Error('Réservé au gérant de l’établissement.');
  return m.venue;
}

const schema = z.object({
  venueId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide.'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide.'),
  discountPct: z.coerce.number().int().min(MIN_DISCOUNT, `Remise minimum −${MIN_DISCOUNT} %.`).max(MAX_DISCOUNT, `Remise maximum −${MAX_DISCOUNT} %.`),
  capacity: z.coerce.number().int().min(1, 'Capacité minimum 1.').max(200),
  weeks: z.coerce.number().int().min(1).max(12).default(1),
});

/** Ouvre un créneau ponctuel, ou le même horaire chaque jour coché pendant N semaines */
export async function createSlotsAction(_prev: SlotFormState, form: FormData): Promise<SlotFormState> {
  try {
    const parsed = schema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const d = parsed.data;
    const venue = await ownVenue(d.venueId);
    const days = form.getAll('dow').map(Number).filter((n) => n >= 1 && n <= 7);
    const span = days.length ? d.weeks * 7 - 1 : 0;
    const res = await db.execute<{ id: string }>(sql`
      insert into slots (venue_id, starts_at, capacity, discount_pct)
      select ${venue.id}, (day::date + ${d.time}::time) at time zone 'Europe/Brussels', ${d.capacity}, ${d.discountPct}
      from generate_series(${d.date}::date, ${d.date}::date + ${span}::int, interval '1 day') as day
      where ((day::date + ${d.time}::time) at time zone 'Europe/Brussels') > now()
        ${days.length ? sql`and extract(isodow from day) in (${sql.join(days.map((n) => sql`${n}`), sql`, `)})` : sql``}
      on conflict (venue_id, starts_at) do nothing
      returning id`);
    const n = [...res].length;
    revalidatePath('/pro', 'layout');
    revalidatePath('/');
    if (n === 0) return { error: 'Aucun créneau créé : horaire déjà passé ou déjà ouvert.' };
    return { ok: true, message: `${n} créneau${n > 1 ? 'x' : ''} ouvert${n > 1 ? 's' : ''}.` };
  } catch (e) {
    console.error(e);
    return { error: 'Les créneaux n’ont pas pu être créés. Réessaie.' };
  }
}

async function ownSlot(slotId: string) {
  if (!z.uuid().safeParse(slotId).success) throw new Error('Créneau introuvable.');
  const [s] = await db.select({ venueId: slots.venueId }).from(slots).where(eq(slots.id, slotId));
  if (!s) throw new Error('Créneau introuvable.');
  await ownVenue(s.venueId);
}

/** Fermer : le créneau disparaît de l'app, les réservations déjà prises restent valables */
export async function toggleSlotAction(form: FormData) {
  const id = String(form.get('slotId'));
  await ownSlot(id);
  await db.update(slots).set({ isOpen: sql`not ${slots.isOpen}` }).where(eq(slots.id, id));
  revalidatePath('/pro/creneaux');
  revalidatePath('/');
}

/** Supprimer n'est possible que sans réservation */
export async function deleteSlotAction(form: FormData) {
  const id = String(form.get('slotId'));
  await ownSlot(id);
  const [b] = await db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.slotId, id), inArray(bookings.status, ['confirmed', 'checked_in']))).limit(1);
  if (b) return;
  await db.delete(bookings).where(eq(bookings.slotId, id));
  await db.delete(slots).where(eq(slots.id, id));
  revalidatePath('/pro/creneaux');
  revalidatePath('/');
}

export async function setDiscountAction(form: FormData) {
  const id = String(form.get('slotId'));
  const pct = Number(form.get('discountPct'));
  if (!Number.isInteger(pct) || pct < MIN_DISCOUNT || pct > MAX_DISCOUNT) return;
  await ownSlot(id);
  await db.update(slots).set({ discountPct: pct }).where(eq(slots.id, id));
  revalidatePath('/pro/creneaux');
  revalidatePath('/');
}
