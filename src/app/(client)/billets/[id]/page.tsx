import Link from 'next/link';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { IconCheck, IconChevronRight, IconPin } from '@/components/icons';
import { getCurrentUser } from '@/lib/auth';
import { CANCEL_HOURS, canCancel, getBooking } from '@/lib/bookings';
import { brusselsDate, euros, longDate, timeLabel } from '@/lib/format';
import { paymentLabel } from '@/lib/email';
import { ShareButton } from './ShareButton';
import { cancelAction } from '../actions';

export const metadata = { title: 'Billet' };

export default async function TicketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nouveau?: string; erreur?: string }> }) {
  const row = await getBooking((await params).id);
  if (!row) notFound();
  const { booking, slot, venue, offer, user: owner } = row;
  const me = await getCurrentUser();
  const isOwner = me?.id === owner.id;
  const sp = await searchParams;
  const isNew = sp.nouveau === '1' && isOwner;
  // Paiement pas encore confirmé par Stripe : pas de code utilisable, on attend.
  if (booking.status === 'pending') {
    return (
      <div className="section" style={{ paddingTop: 22 }}>
        <div className="card stack" style={{ alignItems: 'center', textAlign: 'center', ['--gap' as string]: '10px' }}>
          <h1 className="display" style={{ fontSize: 20 }}>Paiement en cours de validation</h1>
          <p style={{ color: 'var(--ink-2)' }}>Ton billet pour {venue.name} apparaît ici dès que Stripe confirme le paiement, en général en quelques secondes.</p>
          <a className="btn btn-primary" href={`/billets/${booking.id}`}>Actualiser</a>
        </div>
      </div>
    );
  }
  const day = brusselsDate(slot.startsAt);
  const when = day === brusselsDate() ? 'aujourd’hui' : longDate(day);
  const qr = await QRCode.toString(booking.code, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#17142E', light: '#FFFFFF' } });
  const cancelled = booking.status === 'cancelled';

  return (
    <div className="section" style={{ paddingTop: 22 }}>
      {isNew ? (
        <header className="stack" style={{ alignItems: 'center', textAlign: 'center', ['--gap' as string]: '6px' }}>
          <span style={{ width: 50, height: 50, borderRadius: '50%', background: '#1E9E6A', color: '#fff', display: 'grid', placeItems: 'center' }}><IconCheck size={26} /></span>
          <h1 className="display" style={{ fontSize: 22, marginTop: 4 }}>C’est réservé !</h1>
          <p style={{ color: 'var(--ink-2)' }}>{venue.name} t’attend {when} à {timeLabel(slot.startsAt)}.</p>
        </header>
      ) : (
        <div className="row">
          <Link className="small" href="/billets" style={{ fontWeight: 600 }}>← Mes billets</Link>
        </div>
      )}

      <article aria-label="Billet" style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 14px rgba(23,20,46,0.07)', opacity: cancelled ? 0.6 : 1 }}>
        <div className="art row" style={{ ['--c' as string]: venue.color, padding: '14px 16px', color: '#fff' }}>
          <span className="grow" style={{ display: 'flex', flexDirection: 'column' }}>
            <b className="display" style={{ fontSize: 17 }}>{venue.name}</b>
            <span className="small" style={{ fontWeight: 600, opacity: 0.92 }}>{venue.address ?? venue.city}</span>
          </span>
          <span className="display" style={{ fontSize: 13, background: '#fff', color: 'var(--deal)', borderRadius: 7, padding: '5px 9px' }}>−{booking.discountPct} %</span>
        </div>
        <dl className="grid-3" style={{ margin: 0, padding: '14px 16px 12px', gap: 6 }}>
          {[
            ['QUAND', `${day === brusselsDate() ? 'Auj.' : longDate(day).split(' ').slice(1).join(' ')} ${timeLabel(slot.startsAt)}`],
            ['DURÉE', `${offer.durationMin} min`],
            ['GROUPE', `${booking.people} pers.`],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="small muted" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>{k}</dt>
              <dd style={{ margin: '2px 0 0', fontWeight: 700 }}>{v}</dd>
            </div>
          ))}
        </dl>
        <div aria-hidden="true" style={{ position: 'relative', height: 18 }}>
          <span style={{ position: 'absolute', left: -9, top: 0, width: 18, height: 18, borderRadius: '50%', background: 'var(--bg)' }} />
          <span style={{ position: 'absolute', right: -9, top: 0, width: 18, height: 18, borderRadius: '50%', background: 'var(--bg)' }} />
          <span style={{ position: 'absolute', left: 16, right: 16, top: 8, borderTop: '2px dashed var(--line)' }} />
        </div>
        <div className="row" style={{ padding: '10px 16px 16px', ['--gap' as string]: '16px' }}>
          <div role="img" aria-label={`QR code du billet ${booking.code}`} style={{ flex: 'none', width: 108, height: 108 }} dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="grow stack" style={{ ['--gap' as string]: '4px' }}>
            <span className="small muted" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>CODE À L’ACCUEIL</span>
            <b className="display" style={{ fontSize: 24, letterSpacing: '0.08em' }} data-testid="ticket-code">{booking.code}</b>
            <span className="small muted">{euros(booking.totalCents)} · au lieu de {euros(booking.fullCents)}</span>
            <span className="small muted">{booking.paymentMethod === 'simulé' ? 'Paiement simulé (phase de test)' : `Payé par ${paymentLabel(booking.paymentMethod)}`}</span>
            {booking.status === 'checked_in' && <span className="pill pill-ok" style={{ alignSelf: 'flex-start' }}>Arrivée validée</span>}
            {cancelled && <span className="pill pill-deal" style={{ alignSelf: 'flex-start' }}>{booking.refundedAt ? 'Annulée · remboursée' : 'Annulée'}</span>}
          </div>
        </div>
      </article>

      {!cancelled && (
        <>
          <ShareButton title={`${venue.name} · Aubaine`} text={`On va à ${venue.name} ${when} à ${timeLabel(slot.startsAt)} (${booking.people} pers.) ! Code : ${booking.code}`} />
          <ul className="card" style={{ listStyle: 'none', margin: 0, padding: '2px 16px' }}>
            <li className="row" style={{ padding: '12px 0' }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--amber-soft)', color: '#9A5B00', display: 'grid', placeItems: 'center', fontWeight: 800 }}>★</span>
              <span className="grow"><b>+100 points</b> après ta séance</span>
            </li>
            <li style={{ borderTop: '1px solid var(--line-2)' }}>
              <a className="row" href={`/api/billets/${booking.id}/ics`} style={{ padding: '12px 0', color: 'var(--ink)', textDecoration: 'none' }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg></span>
                <span className="grow" style={{ fontWeight: 600 }}>Ajouter au calendrier</span>
                <IconChevronRight size={16} />
              </a>
            </li>
            {venue.address && (
              <li style={{ borderTop: '1px solid var(--line-2)' }}>
                <a className="row" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`} target="_blank" rel="noreferrer" style={{ padding: '12px 0', color: 'var(--ink)', textDecoration: 'none' }}>
                  <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--soft)', display: 'grid', placeItems: 'center' }}><IconPin size={18} /></span>
                  <span className="grow" style={{ fontWeight: 600 }}>Itinéraire</span>
                  <IconChevronRight size={16} />
                </a>
              </li>
            )}
          </ul>
        </>
      )}

      {sp.erreur === 'remboursement' && <p className="notice notice-amber" role="alert">Le remboursement n’a pas pu être lancé : ta réservation est toujours valable. Réessaie dans un instant.</p>}
      {isOwner && canCancel(booking.status, slot.startsAt) && (
        <form action={cancelAction} className="stack" style={{ alignItems: 'center', ['--gap' as string]: '4px' }}>
          <input type="hidden" name="bookingId" value={booking.id} />
          <button className="btn btn-danger btn-sm">Annuler la réservation</button>
          <span className="small muted">Gratuit jusqu’à {CANCEL_HOURS} h avant le début{booking.stripePaymentIntent ? ', remboursé sur ton moyen de paiement' : ''}.</span>
        </form>
      )}
    </div>
  );
}
