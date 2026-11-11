import Link from 'next/link';
import { asc, count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { users, venueEvents, venueMembers, venuePhotos, venues } from '@/db/schema';
import { Checklist } from '@/components/Checklist';
import { Deal, StatusPill, VenueArt } from '@/components/ui';
import { IconImage } from '@/components/icons';
import { CATEGORIES } from '@/lib/categories';
import { ago, euros } from '@/lib/format';
import { discounted } from '@/lib/pricing';
import { checklist, firstPhotos, isReady, offersOf } from '@/lib/venues';
import { ReviewForm } from '../ReviewForm';

const EVENT_LABEL: Record<string, string> = {
  created: 'Fiche créée',
  submitted: 'Envoyée en validation',
  approved: 'Mise en ligne',
  changes_requested: 'Correction demandée',
  rejected: 'Refusée',
  paused: 'Mise en pause',
  paused_after_report: 'Mise en pause après un signalement',
  booking_cancelled: 'Réservation annulée par l’établissement',
  resumed: 'Remise en ligne',
};

const DONE: Record<string, string> = { approve: 'Fiche mise en ligne. L’exploitant est prévenu par email.', changes: 'Correction demandée. L’exploitant a reçu ton message.', reject: 'Fiche refusée. L’exploitant a reçu ton message.' };

/** Fiches envoyées en validation : file d'attente, détail avec checklist et aperçu client */
export async function ValidationView({ id, fait }: { id?: string; fait?: string }) {
  const [queue, all] = await Promise.all([
    db.select().from(venues).where(eq(venues.status, 'submitted')).orderBy(asc(venues.submittedAt)),
    db.select().from(venues).orderBy(desc(venues.updatedAt)),
  ]);

  const selected = all.find((v) => v.id === id) ?? queue[0] ?? null;
  const ids = all.map((v) => v.id);
  const [covers, photoCounts, offerMap] = await Promise.all([
    firstPhotos(ids),
    ids.length
      ? db.select({ venueId: venuePhotos.venueId, n: count() }).from(venuePhotos).where(inArray(venuePhotos.venueId, ids)).groupBy(venuePhotos.venueId)
      : Promise.resolve([]),
    offersOf(ids),
  ]);
  const photoCount = (vid: string) => photoCounts.find((p) => p.venueId === vid)?.n ?? 0;

  const previewOffer = selected ? (offerMap.get(selected.id) ?? []).find((o) => o.isActive) ?? null : null;
  let detail = null;
  if (selected) {
    const [owners, events] = await Promise.all([
      db.select({ email: users.email, firstName: users.firstName }).from(venueMembers).innerJoin(users, eq(users.id, venueMembers.userId)).where(eq(venueMembers.venueId, selected.id)),
      db.select().from(venueEvents).where(eq(venueEvents.venueId, selected.id)).orderBy(desc(venueEvents.createdAt)).limit(8),
    ]);
    const items = checklist(selected, photoCount(selected.id), offerMap.get(selected.id) ?? []);
    detail = { owners, events, items, ready: isReady(items) };
  }

  return (
    <>
      <div className="admin-grid">
        <section className="stack" aria-labelledby="q-title" style={{ ['--gap' as string]: '10px' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 id="q-title" style={{ fontSize: 16, fontWeight: 800 }}>Fiches à valider</h2>
            <span className="small muted">plus anciennes en haut</span>
          </div>
          {queue.length === 0 && <p className="card small muted">Aucune fiche en attente.</p>}
          {queue.map((v) => {
            const items = checklist(v, photoCount(v.id), offerMap.get(v.id) ?? []);
            const ko = items.filter((i) => i.state === 'ko');
            return (
              <Link key={v.id} className="queue-item" href={`/admin?id=${v.id}`} aria-current={selected?.id === v.id ? 'true' : undefined}>
                <span className="row">
                  <VenueArt className="swatch" color={v.color} photoId={covers.get(v.id)} style={{ width: 40, height: 40, borderRadius: 10 }} />
                  <span className="grow" style={{ display: 'flex', flexDirection: 'column' }}>
                    <b>{v.name}</b>
                    <span className="small muted">{CATEGORIES[v.category].label} · {v.city}</span>
                  </span>
                </span>
                <span className="row">
                  {ko.length ? <span className="pill pill-deal">Incomplète : {ko.map((k) => k.key).join(', ')}</span> : <span className="pill pill-ok">Prête à publier</span>}
                  <span className="small muted" style={{ marginLeft: 'auto' }}>{v.submittedAt ? ago(v.submittedAt) : ''}</span>
                </span>
              </Link>
            );
          })}
        </section>

        {selected && detail ? (
          <section className="card stack" aria-labelledby="d-title" style={{ padding: '22px 24px', ['--gap' as string]: '16px' }}>
            <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <VenueArt className="swatch" color={selected.color} photoId={covers.get(selected.id)} style={{ width: 52, height: 52, borderRadius: 14 }} />
              <div className="grow stack" style={{ ['--gap' as string]: '3px' }}>
                <h2 id="d-title" className="display" style={{ fontSize: 20 }}>{selected.name}</h2>
                <span className="small muted">
                  {CATEGORIES[selected.category].label} · {selected.address ?? selected.city} · {detail.owners.map((o) => o.firstName ?? o.email).join(', ') || 'sans exploitant'}
                </span>
              </div>
              <StatusPill status={selected.status} />
            </div>
            {fait && DONE[fait] && <p className="notice notice-ok" role="status">{DONE[fait]}</p>}
            <Checklist items={detail.items} />
            {selected.description && <p className="small" style={{ color: 'var(--ink-2)', background: 'var(--soft)', padding: 12, borderRadius: 12 }}>{selected.description}</p>}
            {selected.status === 'submitted' ? (
              <ReviewForm
                key={selected.id}
                venueId={selected.id}
                ready={detail.ready}
                ownerName={detail.owners[0]?.firstName ?? 'l’exploitant'}
                defaultMessage={
                  detail.ready
                    ? ''
                    : `Bonjour, ta fiche est presque prête. Il manque : ${detail.items.filter((i) => i.state === 'ko').map((i) => i.label.toLowerCase()).join(', ')}. Complète-la depuis l’onglet Établissement et renvoie-la.`
                }
              />
            ) : (
              <p className="small muted">Cette fiche n’est pas en attente de validation.</p>
            )}
            {detail.events.length > 0 && (
              <div className="stack" style={{ ['--gap' as string]: '6px' }}>
                <span className="label">Historique</span>
                {detail.events.map((e) => (
                  <span key={e.id} className="small muted">
                    {ago(e.createdAt)} · {EVENT_LABEL[e.action] ?? e.action}
                    {e.message ? ` : « ${e.message} »` : ''}
                  </span>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="card muted">Sélectionne une fiche.</section>
        )}

        {selected && (
          <section className="stack" aria-labelledby="p-title" style={{ ['--gap' as string]: '10px' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 id="p-title" style={{ fontSize: 16, fontWeight: 800 }}>Aperçu client</h2>
              <Link className="small" href={`/lieu/${selected.slug}`}>ouvrir</Link>
            </div>
            <div className="phone">
              <div className="phone-screen">
                <VenueArt color={selected.color} photoId={covers.get(selected.id)} style={{ height: 150 }}>
                  {!covers.get(selected.id) && (
                    <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 600, fontSize: 13 }}>
                      <span className="stack" style={{ alignItems: 'center', ['--gap' as string]: '6px' }}><IconImage size={26} /> Aucune photo</span>
                    </span>
                  )}
                </VenueArt>
                <div className="stack" style={{ padding: 14, background: '#fff', ['--gap' as string]: '8px' }}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <span className="grow">
                      <b className="display" style={{ fontSize: 16 }}>{selected.name}</b>
                      <span className="small muted" style={{ display: 'block' }}>{CATEGORIES[selected.category].short} · {selected.city}{previewOffer ? ` · ${previewOffer.durationMin} min` : ''}</span>
                    </span>
                    <Deal pct={selected.baseDiscountPct} small />
                  </div>
                  {previewOffer && previewOffer.priceCents > 0 && (
                    <p className="small" style={{ color: 'var(--ink-2)' }}>
                      dès <b style={{ fontSize: 15, color: 'var(--ink)' }}>{euros(discounted(previewOffer.priceCents, selected.baseDiscountPct))}</b>{' '}
                      <s className="muted">{euros(previewOffer.priceCents)}</s> {previewOffer.priceUnit === 'session' ? 'la séance' : 'par personne'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <section className="card" aria-labelledby="all-title" style={{ padding: '8px 8px 4px', overflowX: 'auto' }}>
        <h2 id="all-title" style={{ fontSize: 16, fontWeight: 800, padding: '10px 12px' }}>Tous les établissements</h2>
        <table className="table">
          <thead>
            <tr><th>Nom</th><th>Activité</th><th>Commune</th><th>Statut</th><th>Photos</th><th>Mis à jour</th></tr>
          </thead>
          <tbody>
            {all.map((v) => (
              <tr key={v.id}>
                <td><Link href={`/admin?id=${v.id}`} style={{ fontWeight: 700 }}>{v.name}</Link>{v.isDemo && <span className="pill pill-muted" style={{ marginLeft: 6 }}>démo</span>}</td>
                <td>{CATEGORIES[v.category].short}</td>
                <td>{v.city}</td>
                <td><StatusPill status={v.status} /></td>
                <td className="tnum">{photoCount(v.id)}</td>
                <td className="small muted">{ago(v.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
