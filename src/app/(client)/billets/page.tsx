import Link from 'next/link';
import type { Metadata } from 'next';
import { IconChevronRight, IconTicket } from '@/components/icons';
import { VenueArt } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';
import { myBookings } from '@/lib/bookings';
import { brusselsDate, euros, longDate, timeLabel } from '@/lib/format';
import { firstPhotos } from '@/lib/venues';

export const metadata: Metadata = { title: 'Billets' };

export default async function TicketsPage() {
  const user = await getCurrentUser();
  const list = user ? await myBookings(user.id) : [];
  const now = Date.now();
  const upcoming = list
    .filter((r) => r.booking.status === 'confirmed' && r.slot.startsAt.getTime() > now - 3 * 3_600_000)
    .sort((a, b) => a.slot.startsAt.getTime() - b.slot.startsAt.getTime());
  const past = list.filter((r) => !upcoming.includes(r));
  const photos = await firstPhotos([...new Set(list.map((r) => r.venue.id))]);
  const today = brusselsDate();

  const Row = ({ r }: { r: (typeof list)[number] }) => {
    const day = brusselsDate(r.slot.startsAt);
    const label = { checked_in: 'Honorée', cancelled: 'Annulée', no_show: 'Absent', confirmed: 'Passée' }[r.booking.status];
    return (
      <Link href={`/billets/${r.booking.id}`} className="card row" style={{ textDecoration: 'none', color: 'var(--ink)', padding: 12 }}>
        <VenueArt className="swatch" color={r.venue.color} photoId={photos.get(r.venue.id)} style={{ width: 48, height: 48, borderRadius: 12 }} />
        <span className="grow">
          <b>{r.venue.name}</b>
          <span className="small muted" style={{ display: 'block' }}>
            {day === today ? 'Aujourd’hui' : longDate(day)} · {timeLabel(r.slot.startsAt)} · {r.booking.people} pers. · {euros(r.booking.totalCents)}
          </span>
        </span>
        {upcoming.includes(r) ? <span className="display small" style={{ letterSpacing: '0.06em' }}>{r.booking.code}</span> : <span className="pill pill-muted">{label}</span>}
        <IconChevronRight size={16} />
      </Link>
    );
  };

  return (
    <div className="section" style={{ paddingTop: 28 }}>
      <h1 className="display" style={{ fontSize: 24 }}>Tes billets</h1>
      {!user && (
        <div className="card stack">
          <b>Connecte-toi pour retrouver tes billets.</b>
          <Link className="btn btn-primary" href="/connexion?suite=/billets">Me connecter</Link>
        </div>
      )}
      {user && list.length === 0 && (
        <div className="empty card">
          <IconTicket size={32} />
          <b>Aucun billet pour l’instant</b>
          <p className="small">Tes réservations apparaîtront ici, avec le code à montrer à l’accueil.</p>
          <Link className="btn btn-primary btn-sm" href="/">Trouver un créneau</Link>
        </div>
      )}
      {upcoming.length > 0 && (
        <section className="stack" aria-label="À venir" style={{ ['--gap' as string]: '8px' }}>
          <h2 className="label">À venir</h2>
          {upcoming.map((r) => <Row key={r.booking.id} r={r} />)}
        </section>
      )}
      {past.length > 0 && (
        <section className="stack" aria-label="Historique" style={{ ['--gap' as string]: '8px' }}>
          <h2 className="label">Historique</h2>
          {past.map((r) => <Row key={r.booking.id} r={r} />)}
        </section>
      )}
    </div>
  );
}
