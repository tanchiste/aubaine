import 'server-only';
import { and, desc, eq, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, payouts, slots, venues, type Payout } from '@/db/schema';
import { brusselsDate } from './format';
import { PAYOUT } from './legal';

/**
 * Mode par défaut : Aubaine encaisse les paiements des clients au nom des exploitants (mandat d'encaissement),
 * puis leur vire chaque mois le montant des activités du mois précédent, commission déduite.
 */

/** Jour du mois avant lequel Aubaine fait les virements (conditions partenaires) */
export const PAYOUT_DAY = PAYOUT.day;

/* ---------- IBAN ---------- */

/** IBAN sans espaces et en majuscules s'il est valide (clé modulo 97), sinon null */
export function normalizeIban(input: string): string | null {
  const iban = input.replace(/[\s.-]/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return null;
  if (iban.startsWith('BE') && iban.length !== 16) return null;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1 ? iban : null;
}

/** BE68 5390 0754 7034 */
export const formatIban = (iban: string) => iban.replace(/(.{4})/g, '$1 ').trim();

/* ---------- Mois ---------- */

/** Mois AAAA-MM d'une date, à l'heure de Bruxelles */
export const monthOf = (d: Date = new Date()) => brusselsDate(d).slice(0, 7);

export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export const isMonth = (s: string | undefined): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

const monthFmt = new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const monthLabel = (month: string) => monthFmt.format(new Date(`${month}-15T12:00:00Z`));

/** Communication du virement, reprise sur le relevé de l'exploitant (140 caractères au plus en SEPA) */
export const payoutReference = (month: string, venueName: string) => `Aubaine ${month} ${venueName}`.slice(0, 140);

/** Un mois peut être reversé une fois terminé */
export const isClosed = (month: string) => month < monthOf();

/* ---------- Réservations à reverser ---------- */

/**
 * Réservation payée en ligne à Aubaine, ni annulée ni remboursée : l'exploitant y a droit
 * (y compris quand le client ne s'est pas présenté). Les paiements simulés de la phase de test n'en font pas partie.
 */
const owed = and(
  inArray(bookings.status, ['confirmed', 'checked_in', 'no_show']),
  isNotNull(bookings.paidAt),
  isNull(bookings.refundedAt),
  isNull(bookings.stripeAccountId),
  isNotNull(bookings.paymentMethod),
  ne(bookings.paymentMethod, 'simulé'),
);

/** Activité qui a lieu pendant le mois donné */
const inMonth = (month: string) =>
  and(
    sql`${slots.startsAt} >= (${`${month}-01`}::date)::timestamp at time zone 'Europe/Brussels'`,
    sql`${slots.startsAt} < ((${`${month}-01`}::date) + interval '1 month') at time zone 'Europe/Brussels'`,
  );

export type DueRow = {
  venueId: string;
  name: string;
  legalName: string | null;
  companyNumber: string | null;
  holder: string | null;
  iban: string | null;
  count: number;
  totalCents: number;
  feeCents: number;
  amountCents: number;
  payout: Payout | null;
};

/** Ce que chaque établissement doit recevoir pour les activités d'un mois, et si c'est déjà versé */
export async function dueForMonth(month: string): Promise<DueRow[]> {
  const rows = await db
    .select({
      venueId: venues.id,
      name: venues.name,
      legalName: venues.legalName,
      companyNumber: venues.companyNumber,
      holder: venues.payoutHolder,
      iban: venues.payoutIban,
      count: sql<number>`count(*)::int`,
      totalCents: sql<number>`sum(${bookings.totalCents})::int`,
      feeCents: sql<number>`sum(${bookings.feeCents})::int`,
    })
    .from(bookings)
    .innerJoin(slots, eq(slots.id, bookings.slotId))
    .innerJoin(venues, eq(venues.id, bookings.venueId))
    .where(and(owed, inMonth(month)))
    .groupBy(venues.id)
    .orderBy(venues.name);
  const done = await db.select().from(payouts).where(eq(payouts.month, month));
  const byVenue = new Map(done.map((p) => [p.venueId, p]));
  return rows.map((r) => {
    const payout = byVenue.get(r.venueId) ?? null;
    // Une fois versé, ce sont les montants figés du virement qui font foi
    return payout
      ? { ...r, count: payout.bookingsCount, totalCents: payout.totalCents, feeCents: payout.feeCents, amountCents: payout.amountCents, payout }
      : { ...r, amountCents: r.totalCents - r.feeCents, payout };
  });
}

/** Nombre d'établissements qui attendent un virement pour le mois écoulé (onglet du back-office) */
export async function pendingPayoutCount(): Promise<number> {
  const rows = await dueForMonth(shiftMonth(monthOf(), -1));
  return rows.filter((r) => !r.payout && r.amountCents > 0).length;
}

export type StatementRow = { month: string; count: number; totalCents: number; feeCents: number; amountCents: number; payout: Payout | null };

/** Relevé de l'exploitant, mois par mois (12 derniers mois avec activité) */
export async function venueStatement(venueId: string): Promise<StatementRow[]> {
  const month = sql<string>`to_char(${slots.startsAt} at time zone 'Europe/Brussels', 'YYYY-MM')`;
  const [rows, done] = await Promise.all([
    db
      .select({ month, count: sql<number>`count(*)::int`, totalCents: sql<number>`sum(${bookings.totalCents})::int`, feeCents: sql<number>`sum(${bookings.feeCents})::int` })
      .from(bookings)
      .innerJoin(slots, eq(slots.id, bookings.slotId))
      .where(and(eq(bookings.venueId, venueId), owed))
      .groupBy(month)
      .orderBy(desc(month))
      .limit(12),
    db.select().from(payouts).where(eq(payouts.venueId, venueId)),
  ]);
  const byMonth = new Map(done.map((p) => [p.month, p]));
  return rows.map((r) => {
    const payout = byMonth.get(r.month) ?? null;
    return payout
      ? { month: r.month, count: payout.bookingsCount, totalCents: payout.totalCents, feeCents: payout.feeCents, amountCents: payout.amountCents, payout }
      : { ...r, amountCents: r.totalCents - r.feeCents, payout };
  });
}

export class PayoutError extends Error {}

/**
 * Enregistre le virement fait à un établissement pour un mois terminé : montants et IBAN figés,
 * réservations rattachées au virement. Un seul virement par établissement et par mois.
 */
export async function recordPayout(venueId: string, month: string, adminId: string, reference: string | null): Promise<Payout> {
  if (!isMonth(month) || !isClosed(month)) throw new PayoutError('Ce mois n’est pas terminé.');
  return db.transaction(async (tx) => {
    const [venue] = await tx.select().from(venues).where(eq(venues.id, venueId));
    if (!venue) throw new PayoutError('Établissement introuvable.');
    if (!venue.payoutIban) throw new PayoutError('IBAN manquant : demande-le à l’exploitant.');
    const rows = await tx
      .select({ id: bookings.id, total: bookings.totalCents, fee: bookings.feeCents })
      .from(bookings)
      .innerJoin(slots, eq(slots.id, bookings.slotId))
      .where(and(eq(bookings.venueId, venueId), owed, inMonth(month), isNull(bookings.payoutId)));
    if (!rows.length) throw new PayoutError('Rien à verser pour ce mois.');
    const totalCents = rows.reduce((s, r) => s + r.total, 0);
    const feeCents = rows.reduce((s, r) => s + r.fee, 0);
    const [payout] = await tx
      .insert(payouts)
      .values({
        venueId,
        month,
        bookingsCount: rows.length,
        totalCents,
        feeCents,
        amountCents: totalCents - feeCents,
        holder: venue.payoutHolder,
        iban: venue.payoutIban,
        reference,
        paidBy: adminId,
      })
      .onConflictDoNothing()
      .returning();
    if (!payout) throw new PayoutError('Déjà marqué comme versé.');
    await tx.update(bookings).set({ payoutId: payout.id }).where(inArray(bookings.id, rows.map((r) => r.id)));
    return payout;
  });
}
