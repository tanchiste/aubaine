import Link from 'next/link';
import { and, asc, count, eq, gt, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, venues } from '@/db/schema';
import { ago, euros } from '@/lib/format';
import { BookingsView } from './views/BookingsView';
import { OnlineView } from './views/OnlineView';
import { RevenueView } from './views/RevenueView';
import { ValidationView } from './views/ValidationView';

const VIEWS = ['validation', 'en-ligne', 'reservations', 'chiffre'] as const;
type View = (typeof VIEWS)[number];

/** Back-office : les quatre tuiles du haut servent d'onglets, chacune ouvre sa vue en dessous */
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ id?: string; fait?: string; vue?: string }> }) {
  const sp = await searchParams;
  const vue: View = (VIEWS as readonly string[]).includes(sp.vue ?? '') ? (sp.vue as View) : 'validation';

  const [[queue], published, [{ week }], [month]] = await Promise.all([
    db.select({ n: count(), oldest: sql<Date | null>`min(${venues.submittedAt})` }).from(venues).where(eq(venues.status, 'submitted')),
    db.select({ city: venues.city }).from(venues).where(eq(venues.status, 'published')).orderBy(asc(venues.city)),
    db.select({ week: count() }).from(bookings).where(and(inArray(bookings.status, ['confirmed', 'checked_in']), gt(bookings.createdAt, sql`now() - interval '7 days'`))),
    db
      .select({ cents: sql<number>`coalesce(sum(${bookings.totalCents}), 0)::int`, fee: sql<number>`coalesce(sum(${bookings.feeCents}), 0)::int` })
      .from(bookings)
      .where(and(inArray(bookings.status, ['confirmed', 'checked_in']), sql`${bookings.createdAt} >= date_trunc('month', now() at time zone 'Europe/Brussels') at time zone 'Europe/Brussels'`)),
  ]);
  const cities = [...new Set(published.map((v) => v.city))].join(', ');

  const tiles: { vue: View; label: string; value: string | number; sub: string; alert?: boolean }[] = [
    { vue: 'validation', label: 'Fiches à valider', value: queue.n, sub: queue.oldest ? `la plus ancienne : ${ago(new Date(queue.oldest))}` : 'rien en attente', alert: queue.n > 0 },
    { vue: 'en-ligne', label: 'Établissements en ligne', value: published.length, sub: cities || '–' },
    { vue: 'reservations', label: 'Réservations, 7 derniers jours', value: week, sub: 'confirmées ou honorées' },
    { vue: 'chiffre', label: 'Réservé via Aubaine ce mois', value: euros(month.cents), sub: `${euros(month.fee)} de commission` },
  ];

  return (
    <main className="admin-main">
      <nav className="tiles" aria-label="Vues du back-office">
        {tiles.map((t) => (
          <Link key={t.vue} href={t.vue === 'validation' ? '/admin' : `/admin?vue=${t.vue}`} className="tile tile-link" aria-current={vue === t.vue ? 'page' : undefined} prefetch={false}>
            <span>
              {t.label}
              {t.alert && <i className="tile-alert" title="À traiter" />}
            </span>
            <b>{t.value}</b>
            <small className="small muted">{t.sub}</small>
          </Link>
        ))}
      </nav>

      {vue === 'validation' && <ValidationView id={sp.id} fait={sp.fait} />}
      {vue === 'en-ligne' && <OnlineView />}
      {vue === 'reservations' && <BookingsView />}
      {vue === 'chiffre' && <RevenueView />}
    </main>
  );
}
