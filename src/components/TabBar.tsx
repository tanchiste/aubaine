'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconCompass, IconTicket, IconUser } from './icons';

const TABS = [
  { href: '/', label: 'Explorer', Icon: IconCompass, match: (p: string) => p === '/' || p.startsWith('/lieu') },
  { href: '/billets', label: 'Billets', Icon: IconTicket, match: (p: string) => p.startsWith('/billets') },
  { href: '/profil', label: 'Profil', Icon: IconUser, match: (p: string) => p.startsWith('/profil') },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {TABS.map(({ href, label, Icon, match }) => {
        const active = match(path);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
            <Icon size={22} strokeWidth={active ? 2 : 1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
