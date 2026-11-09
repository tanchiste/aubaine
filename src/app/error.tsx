'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui';

/** Erreur inattendue dans une page : on propose de réessayer sans perdre la navigation */
export default function PageError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && 'digest' in error ? String((error as Error & { digest?: string }).digest ?? '') : '';
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="auth">
      <div className="auth-card">
        <Logo />
        <div className="stack" style={{ ['--gap' as string]: '6px' }}>
          <h1 className="display" style={{ fontSize: 22 }}>Petit souci de notre côté</h1>
          <p className="muted">La page n’a pas pu se charger. Réessaie dans un instant ; si ça persiste, ta connexion ou nos serveurs font une pause.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => retry()}>Réessayer</button>
        <Link className="btn" href="/">Retour à l’accueil</Link>
        {digest && <p className="small muted">Référence : {digest}</p>}
      </div>
    </main>
  );
}
