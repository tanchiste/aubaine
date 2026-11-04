'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoMark } from './icons';

const LINKS = [
  { href: '/', label: 'Explorer', match: (p: string) => p === '/' || p.startsWith('/lieu') || p.startsWith('/reserver') },
  { href: '/billets', label: 'Billets', match: (p: string) => p.startsWith('/billets') },
  { href: '/profil', label: 'Profil', match: (p: string) => p.startsWith('/profil') },
];

export type NavUser = { name: string; pro: boolean; admin: boolean } | null;

/** Barre de navigation en haut, sur ordinateur et tablette (la barre du bas prend le relais sur mobile) */
export function TopNav({ user }: { user: NavUser }) {
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
        {user ? (
          <div className="nav-auth">
            {user.admin && <Link href="/admin" className="btn btn-sm">Back-office</Link>}
            {user.pro && <Link href="/pro" className="btn btn-sm btn-dark">Espace exploitant</Link>}
            <Link href="/profil" className="nav-avatar" title="Mon profil">{user.name.charAt(0).toUpperCase()}</Link>
          </div>
        ) : (
          <div className="nav-auth">
            <Link href="/inscription?type=exploitant" className="small" style={{ fontWeight: 600, marginRight: 8 }}>Vous êtes exploitant ?</Link>
            <Link href="/connexion" className="btn btn-sm">Se connecter</Link>
            <Link href="/inscription" className="btn btn-sm btn-primary">Créer un compte</Link>
          </div>
        )}
      </div>
    </header>
  );
}
