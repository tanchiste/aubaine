import Link from 'next/link';
import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { VenueArt } from '@/components/ui';
import { IconChevronRight, IconLogout, IconShield, IconStore } from '@/components/icons';
import { getCurrentUser, getMyVenues } from '@/lib/auth';
import { myBookings } from '@/lib/bookings';
import { brusselsDate, euros, longDate } from '@/lib/format';
import { cities, firstPhotos } from '@/lib/venues';
import { logoutAction } from './actions';
import { DeleteAccount } from './DeleteAccount';
import { ProfileForm } from './ProfileForm';

export const metadata: Metadata = { title: 'Profil' };

const POINTS_PER_VISIT = 100;
const POINTS_FOR_REWARD = 1000;

const STATUS: Record<string, { label: string; cls: string }> = {
  checked_in: { label: 'Honorée', cls: 'pill-ok' },
  confirmed: { label: 'Passée', cls: 'pill-muted' },
  no_show: { label: 'Absent', cls: 'pill-deal' },
  cancelled: { label: 'Annulée', cls: 'pill-muted' },
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ supprime?: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    const deleted = (await searchParams).supprime === '1';
    return (
      <div className="section" style={{ paddingTop: 28 }}>
        <h1 className="display" style={{ fontSize: 24 }}>Profil</h1>
        {deleted && (
          <p className="notice notice-ok" role="status">
            Ton compte est supprimé et tes données personnelles sont effacées. Un email de confirmation est parti.
          </p>
        )}
        <div className="card stack">
          <b style={{ fontSize: 17 }}>Crée ton compte en 30 secondes</b>
          <p className="muted small">Pour réserver, retrouver tes billets, cumuler des points et parrainer tes amis. Pas de mot de passe : un code par email suffit.</p>
          <Link className="btn btn-primary btn-block" href="/inscription?type=client">Créer un compte</Link>
          <Link className="btn btn-block" href="/connexion?suite=/profil">J’ai déjà un compte</Link>
        </div>
        <Link className="card row" href="/inscription?type=exploitant" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
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

  const [[me], mine, all, cityList] = await Promise.all([
    db.select().from(users).where(eq(users.id, user.id)),
    getMyVenues(user.id),
    myBookings(user.id),
    cities(),
  ]);
  const now = Date.now();
  const past = all.filter((b) => b.slot.startsAt.getTime() < now || b.booking.status === 'checked_in' || b.booking.status === 'no_show');
  const visits = all.filter((b) => b.booking.status === 'checked_in');
  const saved = all.filter((b) => b.booking.status === 'checked_in' || (b.booking.status === 'confirmed' && b.slot.startsAt.getTime() < now)).reduce((s, b) => s + (b.booking.fullCents - b.booking.totalCents), 0);
  const points = visits.length * POINTS_PER_VISIT;
  const toNext = POINTS_FOR_REWARD - (points % POINTS_FOR_REWARD);
  const photos = await firstPhotos([...new Set(past.map((b) => b.venue.id))]);
  const since = new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric' }).format(me.createdAt);

  return (
    <div className="section" style={{ paddingTop: 22 }}>
      <header className="row" style={{ ['--gap' as string]: '12px' }}>
        <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', fontWeight: 600, fontSize: 22 }}>
          {(me.firstName ?? me.email).charAt(0).toUpperCase()}
        </span>
        <span className="grow stack" style={{ ['--gap' as string]: '2px' }}>
          <h1 className="display" style={{ fontSize: 21 }}>{[me.firstName, me.lastName].filter(Boolean).join(' ') || 'Bienvenue'}</h1>
          <span className="small muted">Membre depuis {since}</span>
        </span>
      </header>

      <section className="kpis kpis-short" aria-label="Mes sorties">
        <div className="kpi"><span>Sorties</span><b>{visits.length}</b></div>
        <div className="kpi"><span>Économisé</span><b>{euros(saved)}</b></div>
        <div className="kpi"><span>Points</span><b>{points}</b></div>
      </section>
      <div className="card" style={{ background: 'var(--night)', color: '#fff' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <b>Encore {toNext} points pour 10 € offerts</b>
          <span className="small" style={{ color: '#B9B4E0' }}>100 points par sortie</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.16)', marginTop: 10, overflow: 'hidden' }}>
          <div style={{ width: `${((points % POINTS_FOR_REWARD) / POINTS_FOR_REWARD) * 100}%`, height: '100%', background: 'var(--amber)' }} />
        </div>
        <p className="small" style={{ color: '#B9B4E0', marginTop: 8 }}>Les points seront utilisables très bientôt.</p>
      </div>

      <section className="card stack" aria-labelledby="hist-title" style={{ padding: '6px 16px 10px' }}>
        <div className="row" style={{ justifyContent: 'space-between', paddingTop: 10 }}>
          <h2 id="hist-title" style={{ fontSize: 16, fontWeight: 800 }}>Historique</h2>
          {past.length > 0 && <Link className="small" href="/billets" style={{ fontWeight: 700 }}>Tout voir</Link>}
        </div>
        {past.length === 0 ? (
          <p className="small muted" style={{ padding: '4px 0 6px' }}>Tes sorties passées apparaîtront ici.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {past.slice(0, 5).map((b) => {
              const st = STATUS[b.booking.status] ?? STATUS.confirmed;
              return (
                <li key={b.booking.id} className="row" style={{ padding: '10px 0', borderTop: '1px solid var(--line-2)' }}>
                  <VenueArt className="swatch" color={b.venue.color} photoId={photos.get(b.venue.id)} style={{ width: 42, height: 42, borderRadius: 10 }} />
                  <span className="grow">
                    <b className="ellipsis" style={{ fontSize: 14, display: 'block' }}>{b.venue.name}</b>
                    <span className="small muted" style={{ display: 'block' }}>
                      {longDate(brusselsDate(b.slot.startsAt))} · {b.booking.people} pers. · {euros(b.booking.totalCents)}
                    </span>
                  </span>
                  <span className="stack" style={{ alignItems: 'flex-end', ['--gap' as string]: '4px' }}>
                    <span className={`pill ${st.cls}`}>{st.label}</span>
                    <Link className="small" href={`/lieu/${b.venue.slug}`} style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Réserver à nouveau</Link>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ProfileForm v={{ firstName: me.firstName, lastName: me.lastName, phone: me.phone, city: me.city, email: me.email }} cities={cityList.map((c) => c.city)} />

      <section className="card stack" aria-labelledby="data-title" style={{ ['--gap' as string]: '10px' }}>
        <h2 id="data-title" style={{ fontSize: 16, fontWeight: 800 }}>Mes données</h2>
        <p className="small muted">
          Ce qu’on garde et pourquoi : <Link href="/confidentialite">politique de confidentialité</Link>. Tu peux en recevoir une copie ou tout effacer.
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <a className="btn btn-sm" href="/api/moi/donnees" download>
            Télécharger mes données
          </a>
          <DeleteAccount />
        </div>
      </section>

      <nav className="card" style={{ padding: '4px 16px' }} aria-label="Espaces">
        <Link href={mine.length > 0 ? '/pro' : '/inscription?type=exploitant'} className="row" style={{ padding: '12px 0', textDecoration: 'none', color: 'var(--ink)' }}>
          <IconStore />
          <span className="grow" style={{ fontWeight: 600 }}>{mine.length > 0 ? 'Espace exploitant' : 'Inscrire mon établissement'}</span>
          <IconChevronRight size={16} />
        </Link>
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
    </div>
  );
}
