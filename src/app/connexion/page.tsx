import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/ui';
import { getCurrentUser, showDevCode } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Connexion' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  const next = suite && suite.startsWith('/') && !suite.startsWith('//') ? suite : '/';
  if (await getCurrentUser()) redirect(next);
  const pro = next.startsWith('/pro');
  return (
    <main className="auth">
      <div className="auth-card">
        <Logo />
        <div className="stack" style={{ ['--gap' as string]: '6px' }}>
          <h1 className="display" style={{ fontSize: 22 }}>{pro ? 'Espace exploitant' : 'Connexion'}</h1>
          <p className="muted">{pro ? 'Connecte-toi pour gérer ton établissement.' : 'Pour réserver, retrouver tes billets et tes points.'}</p>
        </div>
        {showDevCode() && process.env.NODE_ENV === 'production' && (
          <p className="notice notice-amber small">Version de test : le code s’affiche à l’écran au lieu d’être envoyé par email.</p>
        )}
        <LoginForm next={next} />
      </div>
    </main>
  );
}
