import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, offers, reports, slots, users, venueMembers, venues } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';

/** Droit d'accès et de portabilité : toutes les données liées au compte, en JSON */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return new Response('Connecte-toi pour télécharger tes données.', { status: 401 });
  const [[profile], booked, memberships, reported] = await Promise.all([
    db
      .select({
        email: users.email,
        prenom: users.firstName,
        nom: users.lastName,
        telephone: users.phone,
        ville: users.city,
        type_de_compte: users.kind,
        conditions_acceptees: users.termsVersion,
        conditions_acceptees_le: users.termsAcceptedAt,
        conditions_partenaires_acceptees: users.partnerTermsVersion,
        cree_le: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, me.id)),
    db
      .select({
        code: bookings.code,
        lieu: venues.name,
        prestation: offers.name,
        debut: slots.startsAt,
        personnes: bookings.people,
        prix_plein_centimes: bookings.fullCents,
        remise_pct: bookings.discountPct,
        paye_centimes: bookings.totalCents,
        statut: bookings.status,
        moyen_de_paiement: bookings.paymentMethod,
        paye_le: bookings.paidAt,
        annule_le: bookings.cancelledAt,
        rembourse_le: bookings.refundedAt,
        reserve_le: bookings.createdAt,
      })
      .from(bookings)
      .innerJoin(slots, eq(slots.id, bookings.slotId))
      .innerJoin(offers, eq(offers.id, slots.offerId))
      .innerJoin(venues, eq(venues.id, bookings.venueId))
      .where(eq(bookings.userId, me.id))
      .orderBy(desc(bookings.createdAt)),
    db
      .select({ etablissement: venues.name, role: venueMembers.role, emails_de_reservation: venueMembers.notify, depuis: venueMembers.createdAt })
      .from(venueMembers)
      .innerJoin(venues, eq(venues.id, venueMembers.venueId))
      .where(eq(venueMembers.userId, me.id)),
    db.select({ motif: reports.reason, message: reports.details, statut: reports.status, decision: reports.resolution, le: reports.createdAt }).from(reports).where(eq(reports.reporterId, me.id)),
  ]);
  const body = {
    exporte_le: new Date().toISOString(),
    source: 'Aubaine',
    compte: profile,
    reservations: booked,
    etablissements: memberships,
    signalements: reported,
    cookies_dans_ton_navigateur: ['aub_session (connexion)', 'aub_ville (ville choisie)', 'aub_pos (position, si partagée)', 'aub_venue (espace exploitant)'],
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="aubaine-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
