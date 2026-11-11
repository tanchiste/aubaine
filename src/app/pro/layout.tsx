import Link from 'next/link';
import { Logo, VenueArt } from '@/components/ui';
import { ProNav } from '@/components/ProNav';
import { VenueSwitcher } from '@/components/VenueSwitcher';
import { IconCompass, IconShield } from '@/components/icons';
import { getProContext } from '@/lib/pro';
import { firstPhotos } from '@/lib/venues';
import { MiniFooter } from '@/components/SiteFooter';

export const metadata = { title: 'Espace exploitant' };

export default async function ProLayout({ children }: { children: React.ReactNode }) {
  const { user, mine, current, role } = await getProContext();
  const navRole = role === 'owner' || user.isAdmin ? 'owner' : 'staff';

  if (!current) {
    return (
      <div style={{ minHeight: '100dvh' }}>
        <header className="pro-top" style={{ display: 'flex' }}>
          <Logo dark href="/pro" suffix={<em className="small" style={{ fontStyle: 'normal', color: '#B9B4E0', marginLeft: 4 }}>Partenaire</em>} />
        </header>
        <main className="pro-content" style={{ margin: '0 auto', maxWidth: 560 }}>
          {children}
          <MiniFooter />
        </main>
      </div>
    );
  }

  const photos = await firstPhotos([current.venue.id]);
  const photoId = photos.get(current.venue.id) ?? null;
  const items = mine.map((m) => ({ id: m.venue.id, name: m.venue.name }));
  const who = user.firstName ?? user.email.split('@')[0];

  return (
    <div className="pro">
      <aside className="pro-side">
        <Logo dark href="/pro" suffix={<em className="small" style={{ fontStyle: 'normal', color: '#B9B4E0', marginLeft: 4 }}>Partenaire</em>} />
        <div className="venue-switch" style={{ cursor: 'default' }}>
          <VenueArt className="swatch" color={current.venue.color} photoId={photoId} />
          <span className="grow" style={{ display: 'flex', flexDirection: 'column' }}>
            <b style={{ fontSize: 14 }}>{current.venue.name}</b>
            <span className="small" style={{ color: '#B9B4E0' }}>{current.venue.city}</span>
          </span>
        </div>
        <VenueSwitcher items={items} currentId={current.venue.id} id="venue-switch-side" />
        <ProNav variant="side" role={navRole} />
        {navRole === 'owner' && (
        <div style={{ marginTop: 'auto', padding: 14, borderRadius: 14, background: 'rgba(255,178,26,0.1)' }}>
          <b className="small" style={{ color: 'var(--amber)', letterSpacing: '0.04em' }}>FORMULE DÉCOUVERTE</b>
          <p className="small" style={{ color: '#E4E1F5', marginTop: 4 }}>15 % par réservation payée, frais bancaires compris. Rien à payer si personne ne réserve.</p>
        </div>
        )}
        <div className="row" style={{ padding: '0 6px', marginTop: navRole === 'owner' ? 0 : 'auto' }}>
          <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--primary)', display: 'grid', placeItems: 'center', fontWeight: 700 }}>{who.charAt(0).toUpperCase()}</span>
          <span className="grow small" style={{ color: '#C9C5E6', display: 'flex', flexDirection: 'column' }}>
            {who}
            <em style={{ fontStyle: 'normal', color: '#8F8AB8' }}>{navRole === 'owner' ? 'Gérant' : 'Accueil'}</em>
          </span>
          {user.isAdmin && <Link href="/admin" title="Back-office Aubaine" aria-label="Back-office Aubaine" style={{ color: 'var(--amber)' }}><IconShield size={18} /></Link>}
          <Link href="/" title="Voir l’app client" style={{ color: '#C9C5E6' }}><IconCompass size={18} /></Link>
        </div>
      </aside>
      <div className="pro-main">
        <header className="pro-top">
          <Logo dark href="/pro" />
          <span className="small" style={{ color: '#B9B4E0', fontWeight: 600 }}>Partenaire</span>
          <span className="grow" />
          <span className="row" style={{ ['--gap' as string]: '8px', fontWeight: 700, fontSize: 14 }}>
            <VenueArt className="swatch" color={current.venue.color} photoId={photoId} style={{ width: 26, height: 26 }} />
            {current.venue.name}
          </span>
          {user.isAdmin && (
            <Link href="/admin" aria-label="Back-office Aubaine" style={{ color: 'var(--amber)', display: 'inline-grid', placeItems: 'center', width: 32, height: 32 }}>
              <IconShield size={18} />
            </Link>
          )}
        </header>
        {items.length > 1 && (
          <div className="pro-top" style={{ paddingTop: 0 }}>
            <VenueSwitcher items={items} currentId={current.venue.id} />
          </div>
        )}
        <main className="pro-content">
          {children}
          <MiniFooter />
        </main>
        <ProNav variant="tabs" role={navRole} />
      </div>
    </div>
  );
}
