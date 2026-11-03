import { isCategory } from './categories';
import { addDays, brusselsDate, isDateStr } from './format';
import type { VenueCategory } from '@/db/schema';

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const DAYS_AHEAD = 7;
export const MAX_PEOPLE = 20;

/** Lit et borne les paramètres d'URL de l'app client (date, nombre de personnes, catégorie, recherche) */
export function clientParams(raw: Raw) {
  const today = brusselsDate();
  const d = one(raw.date);
  const date = isDateStr(d) && d >= today && d <= addDays(today, DAYS_AHEAD - 1) ? d : today;
  const n = Math.min(MAX_PEOPLE, Math.max(1, parseInt(one(raw.n) ?? '', 10) || 2));
  const c = one(raw.cat);
  const category: VenueCategory | undefined = isCategory(c) ? c : undefined;
  const q = (one(raw.q) ?? '').trim().slice(0, 60) || undefined;
  const slot = one(raw.slot);
  return { today, date, n, category, q, slot };
}

/** Construit une URL en gardant les paramètres utiles et en remplaçant ceux donnés */
export function withParams(path: string, base: Record<string, string | number | undefined>, over: Record<string, string | number | undefined> = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...over })) if (v !== undefined && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}
