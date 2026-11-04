import Link from 'next/link';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, slots, users, venuePhotos } from '@/db/schema';
import { Checklist } from '@/components/Checklist';
import { StatusPill } from '@/components/ui';
import { IconEye } from '@/components/icons';
import { brusselsDate, euros, longDate, capitalize, timeLabel } from '@/lib/format';
import { COMMISSION_PCT } from '@/lib/pricing';
import { getProContext } from '@/lib/pro';
import { checklist, isReady } from '@/lib/venues';
import { togglePauseAction } from './actions';
import { CreateVenueForm } from './CreateVenueForm';
import { CheckInBox } from './CheckInBox';
import { checkInIdAction, noShowAction } from './checkin';
import { venueStats } from '@/lib/stats';

export default async function ProHome() {
  const { user, current, role } = await getProContext();

  if (!current) {
    return (
      <>
        <div className="stack" style={{ ['--gap' as string]: '6px', paddingTop: 8 }}>
          <h1 className="display" style={{ fontSize: 24 }}>Inscris ton établissement</h1>
          <p className="muted">Remplis tes heures creuses avec des clients qui n’auraient pas réservé au prix plein.</p>
        </div>
        <CreateVenueForm />
      </>
    );
  }

  const v = current.venue;
  const isOwner = role === 'owner' || user.isAdmin;
  const today = brusselsDate();
  const [[{ photos }], todays, [month]] = await Promise.all([
    db.select({ photos: sql<number>`count(*)::int` }).from(venuePhotos).where(eq(venuePhotos.venueId, v.id)),
    db
      .select({ id: bookings.id, people: bookings.people, total: bookings.totalCents, status: bookings.status, startsAt: slots.startsAt, firstName: users.firstName, discountPct: bookings.discountPct })
      .from(bookings)
      .innerJoin(slots, eq(slots.id, bookings.slotId))
      .innerJoin(users, eq(users.id, bookings.userId))
      .where(
        and(
          eq(bookings.venueId, v.id),
          inArray(bookings.status, ['confirmed', 'checked_in', 'no_show']),
          sql`${slots.startsAt} >= (${today}::date)::timestamp at time zone 'Europe/Brussels'`,
          sql`${slots.startsAt} < (${today}::date + 1)::timestamp at time zone 'Europe/Brussels'`,
        ),
      )
      .orderBy(slots.startsAt),
    db
      .select({ total: sql<number>`coalesce(sum(${bookings.totalCents}), 0)::int` })
      .from(bookings)
      .where(
        and(
          eq(bookings.venueId, v.id),
          inArray(bookings.status, ['confirmed', 'checked_in']),
          sql`${bookings.createdAt} >= date_trunc('month', now() at time zone 'Europe/Brussels') at time zone 'Europe/Brussels'`,
        ),
      ),
  ]);
  const stats = isOwner ? await venueStats(v.id, COMMISSION_PCT) : null;
  const expected = todays.filter((b) => b.status !== 'no_show');
  const items = checklist(v, photos);
  const ready = isReady(items);
  const people = expected.reduce((s, b) => s + b.people, 0);
  const now = Date.now();
  const who = user.firstName ?? '';

  return (
    <>
      <header className="stack" style={{ ['--gap' as string]: '4px' }}>
        <span className="small muted" style={{ fontWeight: 600 }}>{capitalize(longDate(today))}</span>
        <h1 className="display" style={{ fontSize: 24 }}>Bonjour{who ? ` ${who}` : ''}</h1>
        {!isOwner && <p className="muted">Accueil de {v.name} : valide les arrivées avec le code du billet.</p>}
      </header>
      {!isOwner && <CheckInBox />}

      {isOwner && (<>
      <section className="card stack" aria-label="État de la fiche">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>{v.name}</h2>
          <StatusPill status={v.status} />
        </div>
        {v.status === 'draft' && <p className="muted">Ta fiche est en brouillon. Complète-la, ajoute tes photos, puis envoie-la en validation.</p>}
        {v.status === 'submitted' && <p className="notice notice-amber">Fiche en cours de validation. On te répond sous 24 h, par email.</p>}
        {v.status === 'changes_requested' && (
          <div className="notice notice-deal stack" style={{ ['--gap' as string]: '4px' }}>
            <b>Une correction est demandée</b>
            {v.reviewMessage && <span>{v.reviewMessage}</span>}
          </div>
        )}
        {v.status === 'rejected' && <p className="notice notice-deal">{v.reviewMessage ?? 'Cette fiche n’a pas été retenue.'} Écris-nous pour en discuter.</p>}
        {v.status === 'published' && <p className="notice notice-ok">Ta fiche est en ligne : les clients voient tes créneaux creux.</p>}
        {v.status === 'paused' && <p className="notice notice-amber">Fiche en pause : elle est invisible pour les clients.</p>}

        {(v.status === 'draft' || v.status === 'changes_requested') && <Checklist items={items} />}

        <div className="row" style={{ flexWrap: 'wrap' }}>
          {(v.status === 'draft' || v.status === 'changes_requested') && (
            <Link className="btn btn-primary" href="/pro/etablissement">{ready ? 'Relire et envoyer' : 'Compléter ma fiche'}</Link>
          )}
          {(v.status === 'published' || v.status === 'paused') && (
            <>
              <Link className="btn" href={`/lieu/${v.slug}`}><IconEye size={18} /> Voir ma fiche</Link>
              <form action={togglePauseAction}>
                <input type="hidden" name="venueId" value={v.id} />
                <button className="btn">{v.status === 'published' ? 'Mettre en pause' : 'Remettre en ligne'}</button>
              </form>
            </>
          )}
          {v.status === 'submitted' && <Link className="btn" href={`/lieu/${v.slug}`}><IconEye size={18} /> Aperçu client</Link>}
        </div>
      </section>

      <section className="kpis" aria-label="Chiffres clés">
        <div className="kpi">
          <span>Réservations aujourd’hui</span>
          <b>{todays.length}</b>
          <span className="small muted">{people} pers.</span>
        </div>
        <div className="kpi">
          <span>Réservé via Aubaine ce mois</span>
          <b>{euros(month.total)}</b>
          <span className="small muted">total payé par les clients</span>
        </div>
        <div className="kpi">
          <span>Chiffre ajouté ce mois</span>
          <b>{euros(Math.round((month.total * (100 - COMMISSION_PCT)) / 100))}</b>
          <span className="small muted">net, après commission</span>
        </div>
      </section>

      {stats && (
        <section className="card stack" aria-labelledby="perf-title">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <h2 id="perf-title" style={{ fontSize: 15, fontWeight: 800 }}>Rendement</h2>
            <span className="small muted">30 derniers jours</span>
          </div>
          <div className="perf">
            <div><span>Remplissage des créneaux</span><b>{stats.fillPct} %</b><i style={{ ['--w' as string]: `${Math.min(100, stats.fillPct)}%` }} /></div>
            <div><span>Chiffre ajouté (net)</span><b>{euros(stats.netCents)}</b><small>{stats.bookings} réservation{stats.bookings > 1 ? 's' : ''}</small></div>
            <div><span>Clients différents</span><b>{stats.clients}</b><small>panier moyen {euros(stats.avgBasketCents)}</small></div>
            <div><span>Absences</span><b>{stats.noShowPct} %</b><small>des réservations</small></div>
          </div>
          <p className="small" style={{ color: 'var(--ink-2)' }}>
            7 prochains jours : <b>{stats.upcomingFree} {v.capacityUnit === 'places' ? 'places' : 'salles'} encore libres</b> sur {stats.upcomingSlots} créneau{stats.upcomingSlots > 1 ? 'x' : ''} ouvert{stats.upcomingSlots > 1 ? 's' : ''}.{' '}
            <Link href="/pro/creneaux">Gérer mes créneaux</Link>
          </p>
        </section>
      )}
      {(v.status === 'published' || v.status === 'paused') && <CheckInBox />}
      </>)}

      <section className="card stack" aria-labelledby="arr-title" style={{ padding: '6px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', paddingTop: 10 }}>
          <h2 id="arr-title" style={{ fontSize: 15, fontWeight: 800 }}>Arrivées du jour</h2>
          <span className="small muted">{todays.filter((b) => b.status === 'checked_in').length} / {expected.length} arrivé</span>
        </div>
        {todays.length === 0 ? (
          <p className="muted small" style={{ padding: '6px 0 14px' }}>Aucune réservation aujourd’hui pour l’instant.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {todays.map((b) => (
              <li key={b.id} className="row" style={{ padding: '10px 0', borderTop: '1px solid var(--line-2)' }}>
                <b style={{ width: 48 }}>{timeLabel(b.startsAt)}</b>
                <span className="grow">
                  <b style={{ fontSize: 14 }}>{b.firstName ?? 'Client'}</b>
                  <span className="small muted" style={{ display: 'block' }}>{b.people} pers. · {euros(b.total)} · −{b.discountPct} %</span>
                </span>
                {b.status === 'checked_in' ? (
                  <span className="pill pill-ok">Arrivé</span>
                ) : b.status === 'no_show' ? (
                  <span className="pill pill-deal">Absent</span>
                ) : (
                  <span className="row" style={{ ['--gap' as string]: '6px' }}>
                    {b.startsAt.getTime() < now && (
                      <form action={noShowAction}>
                        <input type="hidden" name="bookingId" value={b.id} />
                        <button className="btn btn-sm btn-danger">Absent</button>
                      </form>
                    )}
                    <form action={checkInIdAction}>
                      <input type="hidden" name="bookingId" value={b.id} />
                      <button className="btn btn-sm" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>Valider</button>
                    </form>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
