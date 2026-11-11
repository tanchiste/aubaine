import Link from 'next/link';
import { desc, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, slots, users, venues } from '@/db/schema';
import { ago, brusselsDate, euros, longDate, timeLabel } from '@/lib/format';
import { DailyBars } from '../charts';
import { bookingsByDay } from './data';

const STATUS: Record<string, { label: string; cls: string }> = {
  confirmed: { label: 'Confirmée', cls: 'pill-primary' },
  checked_in: { label: 'Honorée', cls: 'pill-ok' },
  no_show: { label: 'Absent', cls: 'pill-amber' },
  cancelled: { label: 'Annulée', cls: 'pill-muted' },
};

/** Réservations : rythme sur 30 jours et dernières réservations */
export async function BookingsView() {
  const [days, recent] = await Promise.all([
    bookingsByDay(30),
    db
      .select({ b: bookings, startsAt: slots.startsAt, firstName: users.firstName, venue: venues.name, slug: venues.slug })
      .from(bookings)
      .innerJoin(slots, eq(slots.id, bookings.slotId))
      .innerJoin(users, eq(users.id, bookings.userId))
      .innerJoin(venues, eq(venues.id, bookings.venueId))
      .where(ne(bookings.status, 'pending'))
      .orderBy(desc(bookings.createdAt))
      .limit(25),
  ]);
  const week = days.slice(-7).reduce((s, d) => s + d.n, 0);
  const before = days.slice(-14, -7).reduce((s, d) => s + d.n, 0);
  const month = days.reduce((s, d) => s + d.n, 0);
  const trend = before ? Math.round(((week - before) / before) * 100) : null;
  const title = `${week} réservation${week > 1 ? 's' : ''} ces 7 derniers jours${trend !== null ? `, ${trend >= 0 ? '+' : '−'}${Math.abs(trend)} % par rapport aux 7 jours d’avant` : ''}`;

  return (
    <>
      <section className="card stack" aria-labelledby="b-chart" style={{ padding: '20px 22px', ['--gap' as string]: '10px' }}>
        <div className="stack" style={{ ['--gap' as string]: '2px' }}>
          <h2 id="b-chart" style={{ fontSize: 17, fontWeight: 800 }}>{title}</h2>
          <p className="small muted">
            Réservations payées par jour, sur 30 jours ({month} au total). En couleur : les 7 derniers jours. Survole une barre pour le détail.
          </p>
        </div>
        <div className="chart-wrap"><DailyBars days={days} title={title} /></div>
      </section>

      <section className="card" aria-labelledby="b-list" style={{ padding: '8px 8px 4px', overflowX: 'auto' }}>
        <h2 id="b-list" style={{ fontSize: 16, fontWeight: 800, padding: '10px 12px' }}>Dernières réservations</h2>
        {recent.length === 0 ? (
          <p className="small muted" style={{ padding: '0 12px 14px' }}>Aucune réservation pour l’instant.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Réservée</th><th>Client</th><th>Lieu</th><th>Créneau</th><th>Pers.</th><th>Montant</th><th>Statut</th></tr>
            </thead>
            <tbody>
              {recent.map(({ b, startsAt, firstName, venue, slug }) => {
                const st = STATUS[b.status] ?? STATUS.confirmed;
                return (
                  <tr key={b.id}>
                    <td className="small muted">{ago(b.createdAt)}</td>
                    <td>{firstName ?? 'Compte supprimé'}</td>
                    <td><Link href={`/lieu/${slug}`} style={{ fontWeight: 700 }}>{venue}</Link></td>
                    <td className="small">{longDate(brusselsDate(startsAt))}, {timeLabel(startsAt)}</td>
                    <td className="tnum">{b.people}</td>
                    <td className="tnum">{euros(b.totalCents)}</td>
                    <td>
                      <span className={`pill ${st.cls}`}>{st.label}</span>
                      {b.status === 'cancelled' && b.cancelledBy === 'venue' && <span className="small muted" style={{ marginLeft: 6 }}>par le lieu</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
