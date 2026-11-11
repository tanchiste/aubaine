import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { reports, venues } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { DecideForm } from './DecideForm';

export const metadata = { title: 'Signalements' };

const dateFmt = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' });
const STATUS = { open: 'À traiter', resolved: 'Traité', dismissed: 'Rejeté' } as const;

export default async function ReportsPage() {
  await requireAdmin();
  const rows = await db
    .select({ report: reports, venue: { name: venues.name, slug: venues.slug, status: venues.status } })
    .from(reports)
    .leftJoin(venues, eq(venues.id, reports.venueId))
    .orderBy(desc(reports.createdAt))
    .limit(100);
  const open = rows.filter((r) => r.report.status === 'open');
  const done = rows.filter((r) => r.report.status !== 'open');

  return (
    <div className="admin-wrap" style={{ maxWidth: 820, margin: '0 auto', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header className="stack" style={{ ['--gap' as string]: '4px' }}>
        <h1 className="display" style={{ fontSize: 22 }}>Signalements</h1>
        <p className="muted small">Chaque décision est motivée et envoyée à la personne qui a signalé. Les signalements clos sont effacés au bout d’un an.</p>
      </header>
      {open.length === 0 && <p className="card muted">Aucun signalement à traiter.</p>}
      {open.map(({ report: r, venue }) => (
        <article key={r.id} className="card stack" style={{ ['--gap' as string]: '10px' }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <b>{r.reason}</b>
            <span className="small muted">{dateFmt.format(r.createdAt)}</span>
          </div>
          {venue?.slug && (
            <span className="small">
              Fiche : <Link href={`/lieu/${venue.slug}`}>{venue.name}</Link> ({venue.status})
            </span>
          )}
          <p style={{ whiteSpace: 'pre-wrap', color: 'var(--ink-2)' }}>{r.details}</p>
          <span className="small muted">De : {r.email ?? 'compte supprimé'}</span>
          <DecideForm reportId={r.id} canPause={venue?.status === 'published'} />
        </article>
      ))}
      {done.length > 0 && (
        <section className="card stack" aria-label="Signalements traités" style={{ ['--gap' as string]: '0' }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, paddingBottom: 8 }}>Traités</h2>
          {done.map(({ report: r, venue }) => (
            <div key={r.id} className="small" style={{ padding: '10px 0', borderTop: '1px solid var(--line-2)' }}>
              <b>{STATUS[r.status]}</b> · {r.reason}
              {venue?.name ? ` · ${venue.name}` : ''} · {dateFmt.format(r.createdAt)}
              {r.resolution && <span className="muted" style={{ display: 'block' }}>{r.resolution}</span>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
