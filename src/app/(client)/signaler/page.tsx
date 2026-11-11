import Link from 'next/link';
import type { Metadata } from 'next';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { venues } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { ReportForm } from './ReportForm';

export const metadata: Metadata = { title: 'Signaler un contenu', robots: { index: false } };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ lieu?: string }> }) {
  const { lieu } = await searchParams;
  const [user, list] = await Promise.all([
    getCurrentUser(),
    db.select({ slug: venues.slug, name: venues.name }).from(venues).where(eq(venues.status, 'published')).orderBy(asc(venues.name)),
  ]);
  const venue = list.find((v) => v.slug === lieu)?.slug;
  return (
    <div className="section" style={{ paddingTop: 22 }}>
      <header className="stack" style={{ ['--gap' as string]: '6px' }}>
        <h1 className="display" style={{ fontSize: 23 }}>Signaler un contenu</h1>
        <p className="muted">
          Une fiche, une photo, un prix te semble illégal ou trompeur ? Dis-nous ce qui ne va pas : chaque signalement est examiné par l’équipe Aubaine et tu reçois notre décision motivée.
        </p>
      </header>
      <ReportForm venue={venue} venues={list} signedIn={!!user} />
      <p className="small muted">
        Un souci avec une réservation plutôt ? Regarde l’<Link href="/aide">aide</Link> ou écris-nous directement.
      </p>
    </div>
  );
}
