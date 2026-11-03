import 'server-only';
import { cookies } from 'next/headers';
import { getMyVenues, requireUser } from './auth';

export const VENUE_COOKIE = 'aub_venue';

/** Utilisateur connecté, ses établissements et celui qu'il est en train de gérer */
export async function getProContext(next = '/pro') {
  const user = await requireUser(next);
  const mine = await getMyVenues(user.id);
  const selected = (await cookies()).get(VENUE_COOKIE)?.value;
  const current = mine.find((m) => m.venue.id === selected) ?? mine[0] ?? null;
  return { user, mine, current };
}

export function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/&/g, ' et ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'lieu'
  );
}
