import { count, eq } from 'drizzle-orm';
import { db } from '@/db';
import { venues } from '@/db/schema';
import { Logo } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';

export const metadata = { title: 'Back-office' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [{ n }] = await db.select({ n: count() }).from(venues).where(eq(venues.status, 'submitted'));
  return (
    <div style={{ minHeight: '100dvh' }}>
      <header className="admin-top">
        <Logo dark href="/admin" suffix={<em className="small" style={{ fontStyle: 'normal', color: '#B9B4E0', marginLeft: 4 }}>Back-office</em>} />
        <nav className="row" style={{ ['--gap' as string]: '24px' }} aria-label="Back-office">
          <a className="admin-tab" href="/admin" aria-current="page">
            Établissements {n > 0 && <span className="badge-count">{n}</span>}
          </a>
          <span className="admin-tab" aria-disabled="true" title="Bientôt" style={{ opacity: 0.5 }}>Activité</span>
          <span className="admin-tab" aria-disabled="true" title="Bientôt" style={{ opacity: 0.5 }}>Support</span>
        </nav>
        <span className="row small" style={{ marginLeft: 'auto', ['--gap' as string]: '16px', color: '#C9C5E6', whiteSpace: 'nowrap' }}>
          <a href="/" style={{ color: '#C9C5E6', fontWeight: 600 }}>Voir l’app</a>
          {admin.firstName ?? admin.email}
        </span>
      </header>
      {children}
    </div>
  );
}
