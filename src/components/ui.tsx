import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type { VenueCategory, VenueStatus } from '@/db/schema';
import { Pictogram } from './brand';
import { LogoMark, LogoMarkLight } from './icons';

export function Logo({ dark = false, href = '/', suffix }: { dark?: boolean; href?: string; suffix?: ReactNode }) {
  return (
    <Link href={href} className={`logo${dark ? ' on-dark' : ''}`} aria-label={suffix ? undefined : 'Aubaine, accueil'}>
      {dark ? <LogoMarkLight /> : <LogoMark />}
      <span>aubaine</span>
      {suffix}
    </Link>
  );
}

/** Adresse d'une photo à une largeur donnée (160, 480, 800 ou 1200 px, en WebP) */
export const photoSrc = (id: string, w: 160 | 480 | 800 | 1200) => `/api/photos/${id}?w=${w}`;

/** Jeu de largeurs pour srcset : le navigateur prend la plus petite qui reste nette */
export const photoSrcSet = (id: string, widths: (160 | 480 | 800 | 1200)[] = [480, 800, 1200]) => widths.map((w) => `${photoSrc(id, w)} ${w}w`).join(', ');

/** Taille affichée par défaut : cartes pleine largeur sur mobile, 2 ou 3 colonnes au-delà */
const CARD_SIZES = '(max-width: 699px) 92vw, 380px';

/** Première photo de l'établissement, ou illustration de couleur si aucune photo */
export function VenueArt({
  color,
  photoId,
  className = '',
  style,
  children,
  alt = '',
  category,
  sizes = CARD_SIZES,
  priority = false,
}: {
  color: string;
  photoId?: string | null;
  /** sans photo, le pictogramme de l'activité illustre la fiche */
  category?: VenueCategory;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  alt?: string;
  /** largeur affichée, pour que le navigateur choisisse la bonne taille (« 64px » pour une vignette) */
  sizes?: string;
  /** première image visible : chargée tout de suite, en priorité */
  priority?: boolean;
}) {
  const thumb = className.includes('swatch') || (/^\d+px$/.test(sizes) && parseInt(sizes) <= 80);
  return (
    <div className={`art ${className}`} style={{ ['--c' as string]: color, ...style }}>
      {photoId ? (
        <img
          src={photoSrc(photoId, thumb ? 160 : 800)}
          srcSet={thumb ? undefined : photoSrcSet(photoId)}
          sizes={thumb ? undefined : sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
        />
      ) : category ? (
        <Pictogram category={category} size={128} />
      ) : null}
      {children}
    </div>
  );
}

export const STATUS_LABEL: Record<VenueStatus, string> = {
  draft: 'Brouillon',
  submitted: 'En validation',
  changes_requested: 'Correction demandée',
  published: 'En ligne',
  rejected: 'Refusée',
  paused: 'En pause',
};

const STATUS_CLASS: Record<VenueStatus, string> = {
  draft: 'pill-muted',
  submitted: 'pill-amber',
  changes_requested: 'pill-deal',
  published: 'pill-ok',
  rejected: 'pill-deal',
  paused: 'pill-muted',
};

export function StatusPill({ status }: { status: VenueStatus }) {
  return <span className={`pill ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>;
}

/** Remise : la petite part blanche, comme dans le logo, mesure le pourcentage */
export function Deal({ pct, small = false }: { pct: number; small?: boolean }) {
  return (
    <span className={`deal${small ? ' sm' : ''}`} style={{ ['--p' as string]: pct }}>
      −{pct} %
    </span>
  );
}
