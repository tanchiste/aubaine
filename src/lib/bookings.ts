import 'server-only';
import crypto from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, slots, users, venues } from '@/db/schema';
import { quote } from './pricing';
import { unitsFor } from './venues';

/** Délai d'annulation gratuite avant le début du créneau */
export const CANCEL_HOURS = 2;

// Sans 0/O, 1/I/L : lisible à voix haute à l'accueil.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s;
}

export class BookingError extends Error {}

/**
 * Crée une réservation confirmée. Le créneau est verrouillé pendant la transaction :
 * deux clients qui réservent la dernière place en même temps ne peuvent pas l'obtenir tous les deux.
 */
export async function createBooking(userId: string, slotId: string, people: number) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ slot: slots, venue: venues })
      .from(slots)
      .innerJoin(venues, eq(venues.id, slots.venueId))
      .where(eq(slots.id, slotId))
      .for('update', { of: slots });
    if (!row) throw new BookingError('Ce créneau n’existe plus.');
    const { slot, venue } = row;
    if (venue.status !== 'published' || !slot.isOpen) throw new BookingError('Ce créneau n’est plus disponible.');
    if (slot.startsAt.getTime() <= Date.now()) throw new BookingError('Ce créneau a déjà commencé.');
    if (people < venue.groupMin || people > venue.groupMax)
      throw new BookingError(`Ce lieu accueille des groupes de ${venue.groupMin} à ${venue.groupMax} personnes.`);

    const [{ used }] = await tx
      .select({ used: sql<number>`coalesce(sum(case when ${venue.capacityUnit} = 'places' then ${bookings.people} else 1 end), 0)::int` })
      .from(bookings)
      .where(and(eq(bookings.slotId, slot.id), inArray(bookings.status, ['confirmed', 'checked_in'])));
    if (slot.capacity - used < unitsFor(venue, people)) throw new BookingError('Il ne reste plus assez de place sur ce créneau.');

    const price = quote(venue, people, slot.discountPct);
    for (let attempt = 0; attempt < 5; attempt++) {
      const [b] = await tx
        .insert(bookings)
        .values({
          code: newCode(),
          slotId: slot.id,
          venueId: venue.id,
          userId,
          people,
          fullCents: price.full,
          discountPct: slot.discountPct,
          totalCents: price.total,
        })
        .onConflictDoNothing({ target: bookings.code })
        .returning();
      if (b) return { booking: b, venue, slot };
    }
    throw new BookingError('Réessaie dans un instant.');
  });
}

export async function getBooking(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ booking: bookings, slot: slots, venue: venues, user: { id: users.id, firstName: users.firstName, email: users.email } })
    .from(bookings)
    .innerJoin(slots, eq(slots.id, bookings.slotId))
    .innerJoin(venues, eq(venues.id, bookings.venueId))
    .innerJoin(users, eq(users.id, bookings.userId))
    .where(eq(bookings.id, id));
  return row ?? null;
}

export async function myBookings(userId: string) {
  return db
    .select({ booking: bookings, slot: slots, venue: venues })
    .from(bookings)
    .innerJoin(slots, eq(slots.id, bookings.slotId))
    .innerJoin(venues, eq(venues.id, bookings.venueId))
    .where(eq(bookings.userId, userId))
    .orderBy(desc(slots.startsAt))
    .limit(50);
}

export const canCancel = (status: string, startsAt: Date) =>
  status === 'confirmed' && startsAt.getTime() - Date.now() > CANCEL_HOURS * 3_600_000;

/** Valide l'arrivée d'un client à l'accueil, par son code ou par l'identifiant de la réservation */
export async function checkIn(venueId: string, by: { code?: string; id?: string }) {
  const code = by.code?.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!by.id && (!code || code.length !== 6)) return { ok: false as const, error: 'Le code fait 6 caractères.' };
  const [row] = await db
    .select({ booking: bookings, startsAt: slots.startsAt, firstName: users.firstName })
    .from(bookings)
    .innerJoin(slots, eq(slots.id, bookings.slotId))
    .innerJoin(users, eq(users.id, bookings.userId))
    .where(and(eq(bookings.venueId, venueId), by.id ? eq(bookings.id, by.id) : eq(bookings.code, code!)));
  if (!row) return { ok: false as const, error: 'Aucune réservation avec ce code chez toi.' };
  const b = row.booking;
  if (b.status === 'checked_in') return { ok: false as const, error: `${row.firstName ?? 'Ce client'} est déjà validé.` };
  if (b.status === 'cancelled') return { ok: false as const, error: 'Cette réservation a été annulée.' };
  // Validation possible le jour même, jusqu'à 3 h après le début.
  const diff = row.startsAt.getTime() - Date.now();
  if (diff > 12 * 3_600_000) return { ok: false as const, error: 'Cette réservation est pour un autre jour.' };
  if (diff < -3 * 3_600_000) return { ok: false as const, error: 'Ce créneau est passé depuis plus de 3 h.' };
  await db.update(bookings).set({ status: 'checked_in', checkedInAt: new Date() }).where(eq(bookings.id, b.id));
  return { ok: true as const, name: row.firstName ?? 'Client', people: b.people };
}
