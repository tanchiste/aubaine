import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/ui';
import { getCurrentUser, showDevCode } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Connexion' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  const next = suite && suite.startsWith('/') && !suite.startsWith('//') ? suite : '/';
  const user = await getCurrentUser();
  if (user) redirect(next !== '/' ? next : user.kind === 'exploitant' ? '/pro' : '/');
  const pro = next.startsWith('/pro');
  return (
    <main className="auth">
      <div className="auth-card">
        <Logo />
        <div className="stack" style={{ ['--gap' as string]: '6px' }}>
          <h1 className="display" style={{ fontSize: 22 }}>{pro ? 'Espace exploitant' : 'Bon retour !'}</h1>
          <p className="muted">{pro ? 'Connecte-toi pour gérer ton établissement.' : 'Connecte-toi pour réserver et retrouver tes billets.'}</p>
        </div>
        {showDevCode() && process.env.NODE_ENV === 'production' && (
          <p className="notice notice-amber small">Version de test : le code s’affiche à l’écran au lieu d’être envoyé par email.</p>
        )}
        <LoginForm next={next} />
      </div>
    </main>
  );
}
