import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type { VenueStatus } from '@/db/schema';
import { LogoMark, LogoMarkLight } from './icons';

export function Logo({ dark = false, href = '/', suffix }: { dark?: boolean; href?: string; suffix?: ReactNode }) {
  return (
    <Link href={href} className={`logo${dark ? ' on-dark' : ''}`} aria-label="Aubaine, accueil">
      {dark ? <LogoMarkLight /> : <LogoMark />}
      <span>aubaine</span>
      {suffix}
    </Link>
  );
}

/** Première photo de l'établissement, ou illustration de couleur si aucune photo */
export function VenueArt({
  color,
  photoId,
  className = '',
  style,
  children,
  alt = '',
}: {
  color: string;
  photoId?: string | null;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  alt?: string;
}) {
  return (
    <div className={`art ${className}`} style={{ ['--c' as string]: color, ...style }}>
      {photoId ? <img src={`/api/photos/${photoId}`} alt={alt} loading="lazy" /> : null}
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

export function Deal({ pct, small = false }: { pct: number; small?: boolean }) {
  return <span className={`deal${small ? ' sm' : ''}`}>−{pct} %</span>;
}
