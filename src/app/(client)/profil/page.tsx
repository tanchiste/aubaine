import Link from 'next/link';
import type { Metadata } from 'next';
import { IconChevronRight, IconLogout, IconShield, IconStore, IconUser } from '@/components/icons';
import { getCurrentUser, getMyVenues } from '@/lib/auth';
import { logoutAction, saveNameAction } from './actions';

export const metadata: Metadata = { title: 'Profil' };

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="section" style={{ paddingTop: 28 }}>
        <h1 className="display" style={{ fontSize: 24 }}>Profil</h1>
        <div className="card stack">
          <b style={{ fontSize: 16 }}>Connecte-toi pour retrouver tes billets, tes points et ton code de parrainage.</b>
          <Link className="btn btn-primary btn-block" href="/connexion?suite=/profil">Me connecter</Link>
        </div>
        <Link className="card row" href="/pro" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
          <IconStore />
          <span className="grow">
            <b>Tu gères un loisir ?</b>
            <span className="small muted" style={{ display: 'block' }}>Inscris ton établissement et remplis tes heures creuses.</span>
          </span>
          <IconChevronRight size={16} />
        </Link>
      </div>
    );
  }

  const mine = await getMyVenues(user.id);
  const initial = (user.firstName ?? user.email).charAt(0).toUpperCase();

  return (
    <div className="section" style={{ paddingTop: 22 }}>
      <header className="row" style={{ ['--gap' as string]: '12px' }}>
        <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', fontWeight: 600, fontSize: 20 }}>
          {initial}
        </span>
        <span className="grow stack" style={{ ['--gap' as string]: '2px' }}>
          <h1 className="display" style={{ fontSize: 20 }}>{user.firstName ?? 'Bienvenue'}</h1>
          <span className="small muted">{user.email}</span>
        </span>
      </header>

      <form action={saveNameAction} className="card stack">
        <label className="field">
          <span>Prénom</span>
          <input className="input" name="firstName" defaultValue={user.firstName ?? ''} maxLength={40} placeholder="Ton prénom, affiché à l’accueil" />
        </label>
        <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }}>Enregistrer</button>
      </form>

      <div className="card notice-primary stack" style={{ ['--gap' as string]: '4px' }}>
        <b>Points et parrainage</b>
        <span className="small">Ils arrivent avec les premières réservations : 100 points par séance, 10 € offerts tous les 1 000 points, 5 € pour toi et ton ami à chaque parrainage.</span>
      </div>

      <nav className="card" style={{ padding: '4px 16px' }} aria-label="Espaces">
        {(
          <Link href="/pro" className="row" style={{ padding: '12px 0', textDecoration: 'none', color: 'var(--ink)' }}>
            <IconStore />
            <span className="grow" style={{ fontWeight: 600 }}>{mine.length > 0 ? 'Espace exploitant' : 'Inscrire mon établissement'}</span>
            <IconChevronRight size={16} />
          </Link>
        )}
        {user.isAdmin && (
          <Link href="/admin" className="row" style={{ padding: '12px 0', borderTop: '1px solid var(--line-2)', textDecoration: 'none', color: 'var(--ink)' }}>
            <IconShield />
            <span className="grow" style={{ fontWeight: 600 }}>Back-office</span>
            <IconChevronRight size={16} />
          </Link>
        )}
        <form action={logoutAction} style={{ borderTop: '1px solid var(--line-2)' }}>
          <button className="row" style={{ width: '100%', padding: '12px 0', border: 0, background: 'none', cursor: 'pointer', color: 'var(--deal-ink)', fontWeight: 600 }}>
            <IconLogout />
            <span className="grow" style={{ textAlign: 'left' }}>Me déconnecter</span>
          </button>
        </form>
      </nav>
      <p className="small muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><IconUser size={14} /> Compte créé avec ton email, sans mot de passe.</p>
    </div>
  );
}
