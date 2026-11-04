'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconBank, IconCheck, IconClock, IconGrid, IconHome, IconUsers } from './icons';

const OWNER = [
  { href: '/pro', label: 'Tableau de bord', short: 'Tableau', Icon: IconGrid, exact: true },
  { href: '/pro/creneaux', label: 'Créneaux', short: 'Créneaux', Icon: IconClock },
  { href: '/pro/paiements', label: 'Paiements', short: 'Paiements', Icon: IconBank, soon: true },
  { href: '/pro/etablissement', label: 'Établissement', short: 'Fiche', Icon: IconHome },
  { href: '/pro/equipe', label: 'Équipe', short: 'Équipe', Icon: IconUsers },
];
const STAFF = [{ href: '/pro', label: 'Accueil', short: 'Accueil', Icon: IconCheck, exact: true }];

export function ProNav({ variant, role }: { variant: 'side' | 'tabs'; role: 'owner' | 'staff' }) {
  const path = usePathname();
  // Sur mobile, les onglets « bientôt » sont masqués pour garder 4 entrées lisibles.
  const items = (role === 'owner' ? OWNER : STAFF).filter((i) => variant === 'side' || !('soon' in i && i.soon));
  if (variant === 'tabs' && items.length < 2) return null;
  return (
    <nav className={variant === 'side' ? 'pro-nav' : 'pro-tabs'} aria-label="Navigation exploitant" style={variant === 'tabs' ? { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` } : undefined}>
      {items.map((it) => {
        const { href, label, short, Icon } = it;
        const soon = 'soon' in it && it.soon;
        const active = 'exact' in it && it.exact ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={soon ? '#' : href} aria-current={active ? 'page' : undefined} aria-disabled={soon ? 'true' : undefined} title={soon ? 'Bientôt disponible' : undefined}>
            <Icon size={variant === 'side' ? 20 : 22} strokeWidth={active ? 2 : 1.8} />
            {variant === 'side' ? label : short}
            {variant === 'side' && soon && <span className="small" style={{ marginLeft: 'auto', opacity: 0.8 }}>bientôt</span>}
          </Link>
        );
      })}
    </nav>
  );
}
