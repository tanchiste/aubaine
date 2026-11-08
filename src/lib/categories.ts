import type { CSSProperties } from 'react';
import type { VenueCategory } from '@/db/schema';

/**
 * Chaque catégorie a sa couleur, reprise sur les filtres et les étiquettes des cartes.
 * Teintes espacées sur le cercle chromatique, sans rouge (réservé aux remises) ni indigo (couleur d'Aubaine),
 * toutes assez foncées pour un texte blanc lisible (contraste ≥ 4,5).
 */
export const CATEGORIES: Record<VenueCategory, { label: string; short: string; color: string }> = {
  escape: { label: 'Escape game', short: 'Escape', color: '#7E22CE' },
  karting: { label: 'Karting', short: 'Karting', color: '#A16207' },
  laser: { label: 'Laser game', short: 'Laser', color: '#C026D3' },
  vr: { label: 'Réalité virtuelle', short: 'VR', color: '#0E7490' },
  bowling: { label: 'Bowling', short: 'Bowling', color: '#1D4ED8' },
  hache: { label: 'Lancer de haches', short: 'Haches', color: '#7C4A1E' },
  bienetre: { label: 'Bien-être privatif', short: 'Bien-être', color: '#047857' },
  autre: { label: 'Autre activité', short: 'Autre', color: '#475569' },
};

/** À poser sur un filtre ou une étiquette : sa couleur passe par la variable CSS --cat */
export const catStyle = (k: VenueCategory): CSSProperties => ({ ['--cat' as string]: CATEGORIES[k].color });

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as VenueCategory[];

export function isCategory(v: unknown): v is VenueCategory {
  return typeof v === 'string' && v in CATEGORIES;
}

/** Couleurs proposées pour l'illustration de la fiche tant qu'il n'y a pas de photo */
export const VENUE_COLORS = ['#E89A00', '#5B2A86', '#2B8C9E', '#CF3520', '#1E7F57', '#3A28D4', '#8C3B2A', '#1F6F8B'];
