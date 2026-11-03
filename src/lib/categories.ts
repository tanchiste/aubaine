import type { VenueCategory } from '@/db/schema';

export const CATEGORIES: Record<VenueCategory, { label: string; short: string }> = {
  escape: { label: 'Escape game', short: 'Escape' },
  karting: { label: 'Karting', short: 'Karting' },
  laser: { label: 'Laser game', short: 'Laser' },
  vr: { label: 'Réalité virtuelle', short: 'VR' },
  bowling: { label: 'Bowling', short: 'Bowling' },
  hache: { label: 'Lancer de haches', short: 'Haches' },
  bienetre: { label: 'Bien-être privatif', short: 'Bien-être' },
  autre: { label: 'Autre activité', short: 'Autre' },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as VenueCategory[];

export function isCategory(v: unknown): v is VenueCategory {
  return typeof v === 'string' && v in CATEGORIES;
}

/** Couleurs proposées pour l'illustration de la fiche tant qu'il n'y a pas de photo */
export const VENUE_COLORS = ['#E89A00', '#5B2A86', '#2B8C9E', '#CF3520', '#1E7F57', '#3A28D4', '#8C3B2A', '#1F6F8B'];
