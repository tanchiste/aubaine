import type { Venue, VenueCategory } from '@/db/schema';
import { CATEGORIES, CATEGORY_KEYS } from './categories';

/** Minuscules, sans accents ni ponctuation : « Bien-être » → « bien etre » */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Mots que les gens tapent pour chaque type d'activité */
const TERMS: Record<VenueCategory, string[]> = {
  escape: ['escape', 'escape game', 'escape room', 'enigme', 'evasion', 'salle'],
  karting: ['karting', 'kart', 'karts', 'go kart', 'circuit', 'pilotage'],
  laser: ['laser', 'laser game', 'lasergame', 'laser tag'],
  vr: ['vr', 'realite virtuelle', 'virtuel', 'virtuelle', 'casque'],
  bowling: ['bowling', 'quilles', 'boule'],
  hache: ['hache', 'haches', 'lancer de haches', 'axe', 'axe throwing'],
  bienetre: ['bien etre', 'spa', 'jacuzzi', 'sauna', 'hammam', 'detente', 'massage', 'privatif'],
  autre: [],
};

const categoryText = (c: VenueCategory) => normalize([CATEGORIES[c].label, CATEGORIES[c].short, ...TERMS[c]].join(' '));

/** Chaque mot tapé doit se retrouver quelque part : nom, type d'activité, ville, quartier ou description */
export function matchVenue(v: Pick<Venue, 'name' | 'category' | 'city' | 'area' | 'description'>, q: string): boolean {
  const words = normalize(q).split(' ').filter((w) => w.length >= 2);
  if (words.length === 0) return true;
  const hay = ` ${normalize([v.name, v.city, v.area ?? '', v.description ?? ''].join(' '))} ${categoryText(v.category)} `;
  return words.every((w) => hay.includes(` ${w}`) || (w.length >= 4 && hay.includes(w)));
}

/** Types d'activité qui correspondent à ce qui est tapé (« kar » → Karting) */
export function matchCategories(q: string): VenueCategory[] {
  const n = normalize(q);
  if (n.length < 2) return [];
  return CATEGORY_KEYS.filter((c) => c !== 'autre' && ` ${categoryText(c)}`.includes(` ${n}`));
}
