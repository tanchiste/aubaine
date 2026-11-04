import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { slots, venues } from '@/db/schema';
import { Deal, VenueArt } from '@/components/ui';
import { IconBack } from '@/components/icons';
import { euros, longDate, brusselsDate, timeLabel } from '@/lib/format';
import { quote } from '@/lib/pricing';
import { firstPhotos } from '@/lib/venues';
import { getCurrentUser } from '@/lib/auth';
import { BookForm } from './BookForm';

export const metadata = { title: 'Ta réservation' };

/** Récapitulatif et confirmation de la réservation (paiement simulé pendant la phase de test) */
export default async function BookingPage({ searchParams }: { searchParams: Promise<{ slot?: string; n?: string }> }) {
  const sp = await searchParams;
  if (!sp.slot || !/^[0-9a-f-]{36}$/i.test(sp.slot)) notFound();
  const [row] = await db.select({ slot: slots, venue: venues }).from(slots).innerJoin(venues, eq(venues.id, slots.venueId)).where(eq(slots.id, sp.slot));
  if (!row || row.venue.status !== 'published' || row.slot.startsAt < new Date()) notFound();
  const { slot, venue } = row;
  const n = Math.min(venue.groupMax, Math.max(venue.groupMin, parseInt(sp.n ?? '', 10) || 2));
  const price = quote(venue, n, slot.discountPct);
  const photo = (await firstPhotos([venue.id])).get(venue.id);
  const day = brusselsDate(slot.startsAt);
  const user = await getCurrentUser();

  return (
    <div className="section" style={{ paddingTop: 16 }}>
      <div className="row">
        <Link className="icon-btn" href={`/lieu/${venue.slug}?slot=${slot.id}&n=${n}`} aria-label="Retour à la fiche"><IconBack /></Link>
        <h1 className="display" style={{ fontSize: 19 }}>Ta réservation</h1>
      </div>
      <div className="card row" style={{ ['--gap' as string]: '12px' }}>
        <VenueArt className="swatch" color={venue.color} photoId={photo} style={{ width: 52, height: 52, borderRadius: 12 }} />
        <span className="grow">
          <b>{venue.name}</b>
          <span className="small muted" style={{ display: 'block' }}>{day === brusselsDate() ? 'Aujourd’hui' : longDate(day)} · {timeLabel(slot.startsAt)} · {venue.durationMin} min</span>
        </span>
        <Deal pct={slot.discountPct} />
      </div>
      <dl className="card stack" style={{ margin: 0, ['--gap' as string]: '8px' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}><dt className="muted">Personnes</dt><dd style={{ margin: 0, fontWeight: 700 }}>{n}</dd></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><dt className="muted">Prix normal</dt><dd style={{ margin: 0, fontWeight: 600 }}>{euros(price.full)}</dd></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><dt className="muted">Remise heures creuses (−{slot.discountPct} %)</dt><dd style={{ margin: 0, fontWeight: 600, color: 'var(--deal)' }}>−{euros(price.saved)}</dd></div>
        <div className="row" style={{ justifyContent: 'space-between', fontSize: 18, fontWeight: 800, borderTop: '1px dashed var(--line)', paddingTop: 10 }}><dt>Total</dt><dd style={{ margin: 0 }}>{euros(price.total)}</dd></div>
      </dl>
      {user ? (
        <BookForm slotId={slot.id} people={n} total={euros(price.total)} needName={!user.firstName} />
      ) : (
        <div className="stack" style={{ ['--gap' as string]: '10px' }}>
          <Link className="btn btn-primary btn-lg btn-block" href={`/inscription?type=client&suite=${encodeURIComponent(`/reserver?slot=${slot.id}&n=${n}`)}`}>
            Créer mon compte et réserver
          </Link>
          <Link className="btn btn-block" href={`/connexion?suite=${encodeURIComponent(`/reserver?slot=${slot.id}&n=${n}`)}`}>
            J’ai déjà un compte
          </Link>
          <p className="small muted" style={{ textAlign: 'center' }}>Sans mot de passe : un code par email suffit. Billet, points et parrainage au même endroit.</p>
        </div>
      )}
      <p className="small muted" style={{ textAlign: 'center' }}>Annulation gratuite jusqu’à 2 h avant.</p>
    </div>
  );
}
