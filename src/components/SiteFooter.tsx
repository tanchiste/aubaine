import Link from 'next/link';
import { COMPANY } from '@/lib/legal';

const LINKS = [
  { href: '/aide', label: 'Aide et contact' },
  { href: '/conditions', label: 'Conditions' },
  { href: '/confidentialite', label: 'Confidentialité' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/conditions-partenaires', label: 'Devenir partenaire' },
];

/** Pied de page des pages publiques : liens d'information et identification de l'éditeur */
export function SiteFooter() {
  const who = COMPANY.legalName ? `${COMPANY.legalName}${COMPANY.companyNumber ? `, BCE ${COMPANY.companyNumber}` : ''}` : 'Aubaine';
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <nav aria-label="Informations">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} prefetch={false}>
              {l.label}
            </Link>
          ))}
        </nav>
        <p>
          © {new Date().getFullYear()} {who}. Les activités sont fournies par les exploitants ; Aubaine prend la réservation et le paiement en leur nom.
        </p>
      </div>
    </footer>
  );
}

/** Version courte pour les écrans de connexion et les espaces exploitant et admin */
export function MiniFooter() {
  return (
    <p className="footer-mini">
      <Link href="/conditions" prefetch={false}>Conditions</Link>
      <Link href="/confidentialite" prefetch={false}>Confidentialité</Link>
      <Link href="/mentions-legales" prefetch={false}>Mentions légales</Link>
      <Link href="/aide" prefetch={false}>Aide</Link>
    </p>
  );
}
