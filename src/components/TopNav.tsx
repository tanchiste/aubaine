'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoMark } from './icons';

const LINKS = [
  { href: '/', label: 'Explorer', match: (p: string) => p === '/' || p.startsWith('/lieu') || p.startsWith('/reserver') },
  { href: '/billets', label: 'Billets', match: (p: string) => p.startsWith('/billets') },
  { href: '/profil', label: 'Profil', match: (p: string) => p.startsWith('/profil') },
];

/** Barre de navigation en haut, sur ordinateur et tablette (la barre du bas prend le relais sur mobile) */
export function TopNav() {
  const path = usePathname();
  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Link href="/" className="logo" aria-label="Aubaine, accueil">
          <LogoMark />
          <span>aubaine</span>
        </Link>
        <nav aria-label="Navigation principale" className="topnav-links">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={l.match(path) ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href="/pro" className="btn btn-sm">Vous êtes exploitant ?</Link>
      </div>
    </header>
  );
}
