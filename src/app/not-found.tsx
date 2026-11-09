import Link from 'next/link';
import { Logo } from '@/components/ui';

export const metadata = { title: 'Page introuvable' };

/** Lien cassé, lieu retiré ou créneau déjà passé */
export default function NotFound() {
  return (
    <main className="auth">
      <div className="auth-card">
        <Logo />
        <div className="stack" style={{ ['--gap' as string]: '6px' }}>
          <h1 className="display" style={{ fontSize: 22 }}>Rien à cette adresse</h1>
          <p className="muted">Ce lieu ou ce créneau n’est plus disponible : les créneaux passés disparaissent d’eux-mêmes, et un lien peut avoir été coupé en route.</p>
        </div>
        <Link className="btn btn-primary" href="/">Voir les créneaux du moment</Link>
      </div>
    </main>
  );
}
