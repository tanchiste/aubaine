import { isCategory } from './categories';
import { addDays, brusselsDate, isDateStr } from './format';
import type { VenueCategory } from '@/db/schema';

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Jours visibles dans la bande de dates */
export const DAYS_AHEAD = 7;
/** Jours réservables via le calendrier */
export const MAX_DAYS = 30;
export const MAX_PEOPLE = 20;
export const CITY_COOKIE = 'aub_ville';

export const MOMENTS = {
  matin: { label: 'Matin', from: 0, to: 12 },
  aprem: { label: 'Après-midi', from: 12, to: 18 },
  soir: { label: 'Soir', from: 18, to: 24 },
} as const;
export type Moment = keyof typeof MOMENTS;

/** Plage horaire filtrée : un moment de la journée ou des heures choisies (de 14 h à 16 h) */
export type HourRange = { from: number; to: number; label: string };
export const hourLabel = (from: number, to: number) => (to - from === 1 ? `${from} h à ${to} h` : `${from} h – ${to} h`);

export const SORTS = { remise: 'Meilleure remise', heure: 'Plus tôt', prix: 'Moins cher' } as const;
export type Sort = keyof typeof SORTS;

/** Lit et borne les paramètres d'URL de l'app client */
export function clientParams(raw: Raw, savedCity?: string) {
  const today = brusselsDate();
  const d = one(raw.date);
  const date = isDateStr(d) && d >= today && d <= addDays(today, MAX_DAYS - 1) ? d : today;
  const n = Math.min(MAX_PEOPLE, Math.max(1, parseInt(one(raw.n) ?? '', 10) || 2));
  const c = one(raw.cat);
  const category: VenueCategory | undefined = isCategory(c) ? c : undefined;
  const q = (one(raw.q) ?? '').trim().slice(0, 60) || undefined;
  const slot = one(raw.slot);
  const m = one(raw.moment);
  const de = parseInt(one(raw.de) ?? '', 10);
  const a = parseInt(one(raw.a) ?? '', 10);
  const custom = Number.isInteger(de) && Number.isInteger(a) && de >= 0 && a <= 24 && de < a ? { from: de, to: a, label: hourLabel(de, a) } : undefined;
  const moment: Moment | undefined = !custom && m && m in MOMENTS ? (m as Moment) : undefined;
  const hours: HourRange | undefined = custom ?? (moment ? { ...MOMENTS[moment] } : undefined);
  const t = one(raw.tri);
  const sort: Sort = t && t in SORTS ? (t as Sort) : 'remise';
  // « tout » = tout le Hainaut ; sans paramètre, on reprend la dernière ville choisie.
  const v = (one(raw.ville) ?? savedCity)?.trim().slice(0, 40);
  const city = !v || v === 'tout' ? undefined : v;
  return { today, date, n, category, q, slot, moment, de: custom?.from, a: custom?.to, hours, sort, city };
}

/** Construit une URL en gardant les paramètres utiles et en remplaçant ceux donnés */
export function withParams(path: string, base: Record<string, string | number | undefined>, over: Record<string, string | number | undefined> = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...over })) if (v !== undefined && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}
