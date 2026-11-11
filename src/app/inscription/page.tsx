import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MiniFooter } from '@/components/SiteFooter';
import { Logo } from '@/components/ui';
import { IconCompass, IconStore } from '@/components/icons';
import { getCurrentUser, showDevCode } from '@/lib/auth';
import { SignupForm } from './SignupForm';

export const metadata: Metadata = { title: 'Créer un compte' };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ type?: string; suite?: string }> }) {
  const { type, suite } = await searchParams;
  const next = suite && suite.startsWith('/') && !suite.startsWith('//') ? suite : '/';
  const user = await getCurrentUser();
  if (user) redirect(type === 'exploitant' ? '/pro' : next);
  const kind = type === 'exploitant' ? 'exploitant' : type === 'client' ? 'client' : null;
  const q = (t: string) => `/inscription?type=${t}${next !== '/' ? `&suite=${encodeURIComponent(next)}` : ''}`;

  return (
    <main className="auth">
      <div className="auth-card">
        <Logo />
        <div className="stack" style={{ ['--gap' as string]: '6px' }}>
          <h1 className="display" style={{ fontSize: 22 }}>Créer un compte</h1>
          <p className="muted">
            {kind === 'exploitant'
              ? 'Inscris ton établissement : tu complètes ta fiche juste après.'
              : kind === 'client'
                ? 'Pour réserver tes sorties à prix creux.'
                : 'Tu veux…'}
          </p>
        </div>

        {!kind ? (
          <div className="stack" style={{ ['--gap' as string]: '10px' }}>
            <Link className="choice" href={q('client')}>
              <span className="choice-icon"><IconCompass size={24} /></span>
              <span className="grow">
                <b>Réserver des activités</b>
                <span className="small muted">Karting, escape game, bowling… jusqu’à −50 % aux heures creuses.</span>
              </span>
            </Link>
            <Link className="choice" href={q('exploitant')}>
              <span className="choice-icon" style={{ background: 'var(--amber-soft)', color: '#7A4A00' }}><IconStore size={24} /></span>
              <span className="grow">
                <b>Remplir mon établissement</b>
                <span className="small muted">Je gère un loisir et je veux vendre mes heures creuses.</span>
              </span>
            </Link>
            <p className="auth-switch">
              Déjà un compte ? <Link href={`/connexion${next !== '/' ? `?suite=${encodeURIComponent(next)}` : ''}`}>Me connecter</Link>
            </p>
          </div>
        ) : (
          <>
            <div className="segmented" role="tablist" aria-label="Type de compte">
              <Link href={q('client')} role="tab" aria-selected={kind === 'client'} className="seg-link">Client</Link>
              <Link href={q('exploitant')} role="tab" aria-selected={kind === 'exploitant'} className="seg-link">Exploitant</Link>
            </div>
            {showDevCode() && process.env.NODE_ENV === 'production' && (
              <p className="notice notice-amber small">Version de test : le code s’affiche à l’écran au lieu d’être envoyé par email.</p>
            )}
            <SignupForm key={kind} kind={kind} next={next} />
          </>
        )}
      </div>
      <MiniFooter />
    </main>
  );
}
