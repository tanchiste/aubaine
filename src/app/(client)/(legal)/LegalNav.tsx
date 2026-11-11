'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const LEGAL_PAGES = [
  { href: '/aide', label: 'Aide et contact' },
  { href: '/conditions', label: 'Conditions' },
  { href: '/confidentialite', label: 'Confidentialité' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/conditions-partenaires', label: 'Partenaires' },
  { href: '/mentions-legales', label: 'Mentions légales' },
];

/** Onglets entre les pages d'information, sur une ligne qui défile sur mobile */
export function LegalNav() {
  const path = usePathname();
  return (
    <nav className="legal-nav" aria-label="Informations">
      {LEGAL_PAGES.map((p) => (
        <Link key={p.href} href={p.href} prefetch={false} className="chip" aria-current={path === p.href ? 'page' : undefined}>
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
