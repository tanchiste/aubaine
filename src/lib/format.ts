export const TZ = 'Europe/Brussels';

const eur = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' });
const eurRound = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/** 5720 → « 57,20 € » ; 8800 → « 88 € » */
export function euros(cents: number): string {
  return cents % 100 === 0 ? eurRound.format(cents / 100) : eur.format(cents / 100);
}

const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const hm = new Intl.DateTimeFormat('fr-BE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

/** Date du jour à Bruxelles, au format AAAA-MM-JJ */
export function brusselsDate(d: Date = new Date()): string {
  return ymd.format(d);
}

export function timeLabel(d: Date): string {
  return hm.format(d).replace(' h ', ':');
}

export function isDateStr(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T12:00:00Z'));
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const weekdayShort = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', timeZone: 'UTC' });
const longFmt = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export function dayChip(dateStr: string, today: string): { top: string; num: string } {
  const d = new Date(dateStr + 'T12:00:00Z');
  const top = dateStr === today ? 'Auj.' : capitalize(weekdayShort.format(d).replace('.', ''));
  return { top, num: String(d.getUTCDate()) };
}

/** « mardi 3 novembre » */
export function longDate(dateStr: string): string {
  return longFmt.format(new Date(dateStr + 'T12:00:00Z'));
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** « il y a 3 h », « hier », « il y a 2 jours » */
export function ago(d: Date, now: Date = new Date()): string {
  const min = Math.round((now.getTime() - d.getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.round(h / 24);
  return days === 1 ? 'hier' : `il y a ${days} jours`;
}

const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' });
/** Heure (0 à 23) à Bruxelles */
export const brusselsHour = (d: Date) => parseInt(hourFmt.format(d), 10);

const dayShort = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
/** « Aujourd’hui », « Demain », « jeu. 6 » */
export function relativeDay(dateStr: string, today: string): string {
  if (dateStr === today) return 'Aujourd’hui';
  if (dateStr === addDays(today, 1)) return 'Demain';
  return dayShort.format(new Date(dateStr + 'T12:00:00Z'));
}
