/** Positions, distances et géocodage des adresses */

export type LatLng = { lat: number; lng: number };

/** Cookie où le navigateur garde la position du client (arrondie à ~100 m, jamais enregistrée côté serveur) */
export const POS_COOKIE = 'aub_pos';

/** Lit « 50.454,3.952 » ; refuse tout ce qui sort largement de la Belgique et ses environs */
export function parsePos(raw: string | undefined | null): LatLng | null {
  if (!raw) return null;
  const [a, b] = decodeURIComponent(raw).split(',').map(Number);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < 48 || a > 53 || b < 1 || b > 8) return null;
  return { lat: a, lng: b };
}

export const hasPos = (v: { lat: number | null; lng: number | null }): v is { lat: number; lng: number } => v.lat !== null && v.lng !== null;

/** Distance à vol d'oiseau, en kilomètres */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** « 650 m », « 4,2 km », « 18 km » */
export function distanceLabel(km: number): string {
  if (km < 1) return `${Math.max(100, Math.round(km * 10) * 100)} m`;
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}

/**
 * Trouve la position d'une adresse belge avec Nominatim (OpenStreetMap).
 * Appelé seulement quand un exploitant enregistre son adresse : bien en dessous de la limite d'usage (1 requête par seconde).
 */
export async function geocode(address: string | null, city: string): Promise<LatLng | null> {
  const q = [address, city, 'Belgique'].filter(Boolean).join(', ');
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({ q, format: 'jsonv2', limit: '1', countrycodes: 'be', viewbox: '2.8,50.9,4.9,49.9' }).toString();
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': `Aubaine/1.0 (${process.env.APP_URL ?? 'https://aubaine.be'})`, 'Accept-Language': 'fr' },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    const pos = hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
    return pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lng) ? pos : null;
  } catch {
    return null;
  }
}
