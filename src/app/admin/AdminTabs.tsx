'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Onglets du back-office, avec le nombre d'éléments en attente */
export function AdminTabs({ pendingVenues, openReports }: { pendingVenues: number; openReports: number }) {
  const path = usePathname();
  const tabs = [
    { href: '/admin', label: 'Établissements', n: pendingVenues, active: path === '/admin' },
    { href: '/admin/signalements', label: 'Signalements', n: openReports, active: path.startsWith('/admin/signalements') },
  ];
  return (
    <nav className="row" style={{ ['--gap' as string]: '24px' }} aria-label="Back-office">
      {tabs.map((t) => (
        <Link key={t.href} className="admin-tab" href={t.href} aria-current={t.active ? 'page' : undefined}>
          {t.label} {t.n > 0 && <span className="badge-count">{t.n}</span>}
        </Link>
      ))}
    </nav>
  );
}
