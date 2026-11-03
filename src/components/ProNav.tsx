'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconBank, IconClock, IconGrid, IconHome } from './icons';

const ITEMS = [
  { href: '/pro', label: 'Tableau de bord', short: 'Tableau', Icon: IconGrid, exact: true },
  { href: '/pro/creneaux', label: 'Créneaux', short: 'Créneaux', Icon: IconClock, soon: true },
  { href: '/pro/paiements', label: 'Paiements', short: 'Paiements', Icon: IconBank, soon: true },
  { href: '/pro/etablissement', label: 'Établissement', short: 'Établissement', Icon: IconHome },
];

export function ProNav({ variant }: { variant: 'side' | 'tabs' }) {
  const path = usePathname();
  return (
    <nav className={variant === 'side' ? 'pro-nav' : 'pro-tabs'} aria-label="Navigation exploitant">
      {ITEMS.map(({ href, label, short, Icon, exact, soon }) => {
        const active = exact ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={soon ? '#' : href}
            aria-current={active ? 'page' : undefined}
            aria-disabled={soon ? 'true' : undefined}
            title={soon ? 'Bientôt disponible' : undefined}
          >
            <Icon size={variant === 'side' ? 20 : 22} strokeWidth={active ? 2 : 1.8} />
            {variant === 'side' ? label : short}
            {variant === 'side' && soon && <span className="small" style={{ marginLeft: 'auto', opacity: 0.8 }}>bientôt</span>}
          </Link>
        );
      })}
    </nav>
  );
}
