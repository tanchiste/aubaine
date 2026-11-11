import 'server-only';
import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, loginCodes, offers, reports, sessions, slots, users, venueMembers, venues } from '@/db/schema';
import { getBooking } from './bookings';
import { bookingReminderMail, sendMail, venueBookingMail, venueDigestMail, type DigestLine } from './email';
import { addDays, brusselsDate, timeLabel } from './format';

/** Membres de l'équipe qui veulent être prévenus (réservations, annulations, récap de la veille) */
export async function venueRecipients(venueId: string): Promise<string[]> {
  const rows = await db
    .select({ email: users.email })
    .from(venueMembers)
    .innerJoin(users, eq(users.id, venueMembers.userId))
    .where(and(eq(venueMembers.venueId, venueId), eq(venueMembers.notify, true), isNull(users.deletedAt)));
  return [...new Set(rows.map((r) => r.email))];
}

/** Prévient l'établissement d'une nouvelle réservation ou d'une annulation par le client */
export async function notifyVenueBooking(bookingId: string, kind: 'new' | 'cancelled') {
  try {
    const row = await getBooking(bookingId);
    if (!row) return;
    const to = await venueRecipients(row.venue.id);
    await Promise.allSettled(to.map((email) => sendMail(venueBookingMail(row, kind, email))));
  } catch (e) {
    console.error('[email] établissement', e);
  }
}

/** Créneaux de demain (heure de Bruxelles) */
const tomorrowRange = (now: Date) => {
  const day = addDays(brusselsDate(now), 1);
  return {
    day,
    from: sql`(${day}::date)::timestamp at time zone 'Europe/Brussels'`,
    to: sql`(${day}::date + 1)::timestamp at time zone 'Europe/Brussels'`,
  };
};

/** Rappel la veille à chaque client qui a une réservation confirmée demain, une seule fois */
export async function sendReminders(now = new Date()): Promise<number> {
  const { from, to } = tomorrowRange(now);
  const due = await db
    .select({ id: bookings.id })
    .from(bookings)
    .innerJoin(slots, eq(slots.id, bookings.slotId))
    .where(and(eq(bookings.status, 'confirmed'), isNull(bookings.remindedAt), sql`${slots.startsAt} >= ${from}`, sql`${slots.startsAt} < ${to}`));
  let sent = 0;
  for (const { id } of due) {
    // Marqué d'abord : un second passage du cron ne renvoie pas le même rappel.
    const [claimed] = await db.update(bookings).set({ remindedAt: new Date() }).where(and(eq(bookings.id, id), isNull(bookings.remindedAt))).returning({ id: bookings.id });
    if (!claimed) continue;
    const row = await getBooking(id);
    if (!row) continue;
    try {
      await sendMail(bookingReminderMail(row));
      sent++;
    } catch (e) {
      console.error('[email] rappel', e);
      await db.update(bookings).set({ remindedAt: null }).where(eq(bookings.id, id));
    }
  }
  return sent;
}

/** Récap de demain pour chaque établissement qui a au moins une réservation */
export async function sendVenueDigests(now = new Date()): Promise<number> {
  const { day, from, to } = tomorrowRange(now);
  const rows = await db
    .select({ venue: venues, startsAt: slots.startsAt, firstName: users.firstName, people: bookings.people, offer: offers.name, code: bookings.code })
    .from(bookings)
    .innerJoin(slots, eq(slots.id, bookings.slotId))
    .innerJoin(offers, eq(offers.id, slots.offerId))
    .innerJoin(venues, eq(venues.id, bookings.venueId))
    .innerJoin(users, eq(users.id, bookings.userId))
    .where(and(eq(bookings.status, 'confirmed'), sql`${slots.startsAt} >= ${from}`, sql`${slots.startsAt} < ${to}`))
    .orderBy(slots.startsAt);
  const byVenue = new Map<string, { venue: (typeof rows)[number]['venue']; lines: DigestLine[] }>();
  for (const r of rows) {
    const entry = byVenue.get(r.venue.id) ?? { venue: r.venue, lines: [] };
    entry.lines.push({ time: timeLabel(r.startsAt), firstName: r.firstName, people: r.people, offer: r.offer, code: r.code });
    byVenue.set(r.venue.id, entry);
  }
  let sent = 0;
  for (const { venue, lines } of byVenue.values()) {
    const to = await venueRecipients(venue.id);
    const results = await Promise.allSettled(to.map((email) => sendMail(venueDigestMail(venue, day, lines, email))));
    sent += results.filter((r) => r.status === 'fulfilled').length;
  }
  return sent;
}

/**
 * Ménage quotidien, conforme aux durées annoncées dans la politique de confidentialité :
 * codes de connexion et sessions expirés, signalements clos depuis plus d'un an.
 */
export async function housekeeping(now = new Date()) {
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const yearAgo = new Date(now.getTime() - 365 * 86_400_000);
  const codes = await db.delete(loginCodes).where(lt(loginCodes.expiresAt, dayAgo)).returning({ id: loginCodes.id });
  const expired = await db.delete(sessions).where(lt(sessions.expiresAt, now)).returning({ id: sessions.id });
  const closed = await db
    .delete(reports)
    .where(and(inArray(reports.status, ['resolved', 'dismissed']), lt(reports.resolvedAt, yearAgo)))
    .returning({ id: reports.id });
  return { codes: codes.length, sessions: expired.length, reports: closed.length };
}
