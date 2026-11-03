import type { Venue } from '@/db/schema';

export const MIN_DISCOUNT = 20;
export const MAX_DISCOUNT = 60;

export function discounted(cents: number, pct: number): number {
  return Math.round((cents * (100 - pct)) / 100);
}

/** Prix plein et prix remisé d'une réservation pour un groupe donné */
export function quote(v: Pick<Venue, 'priceCents' | 'priceUnit'>, people: number, pct: number) {
  const units = v.priceUnit === 'session' ? 1 : people;
  const full = v.priceCents * units;
  return { full, total: discounted(full, pct), saved: full - discounted(full, pct) };
}

export function priceUnitLabel(v: Pick<Venue, 'priceUnit'>): string {
  return v.priceUnit === 'session' ? 'la séance' : 'par pers.';
}

/** Formule Découverte : commission prélevée sur chaque réservation honorée */
export const COMMISSION_PCT = 15;
