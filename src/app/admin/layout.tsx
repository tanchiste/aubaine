import { count, eq } from 'drizzle-orm';
import { db } from '@/db';
import { reports, venues } from '@/db/schema';
import { MiniFooter } from '@/components/SiteFooter';
import { Logo } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { companyReady } from '@/lib/legal';
import { pendingPayoutCount } from '@/lib/payouts';
import { AdminTabs } from './AdminTabs';

export const metadata = { title: 'Back-office' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [[{ n }], [{ open }], payoutsDue] = await Promise.all([
    db.select({ n: count() }).from(venues).where(eq(venues.status, 'submitted')),
    db.select({ open: count() }).from(reports).where(eq(reports.status, 'open')),
    pendingPayoutCount(),
  ]);
  return (
    <div style={{ minHeight: '100dvh' }}>
      <header className="admin-top">
        <Logo dark href="/admin" suffix={<em className="small" style={{ fontStyle: 'normal', color: '#B9B4E0', marginLeft: 4 }}>Back-office</em>} />
        <AdminTabs pendingVenues={n} openReports={open} pendingPayouts={payoutsDue} />
        <span className="row small" style={{ marginLeft: 'auto', ['--gap' as string]: '16px', color: '#C9C5E6', whiteSpace: 'nowrap' }}>
          <a href="/" style={{ color: '#C9C5E6', fontWeight: 600 }}>Voir l’app</a>
          {admin.firstName ?? admin.email}
        </span>
      </header>
      {!companyReady() && (
        <p className="notice notice-amber" style={{ margin: '14px 16px 0' }}>
          Mentions légales incomplètes : renseigne la société (raison sociale, numéro d’entreprise, adresse, email) dans src/lib/legal.ts avant l’ouverture au public.
        </p>
      )}
      {children}
      <div style={{ padding: '20px 16px 28px' }}>
        <MiniFooter />
      </div>
    </div>
  );
}
