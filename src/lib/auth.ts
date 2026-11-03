import 'server-only';
import crypto from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { loginCodes, sessions, users, venueMembers, venues } from '@/db/schema';
import { loginCodeMail, sendMail } from './email';

const SESSION_COOKIE = 'aub_session';
const SESSION_DAYS = 30;
const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;

export type CurrentUser = { id: string; email: string; firstName: string | null; isAdmin: boolean };

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET manquant ou trop court.');
  return 'dev-secret-ne-pas-utiliser-en-production';
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const codeHash = (email: string, code: string) =>
  crypto.createHmac('sha256', secret()).update(`${email}:${code}`).digest('hex');

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email({ message: 'Adresse email invalide.' }));

/**
 * Sans service d'email (développement, tests, phase de test en ligne), le code est affiché à l'écran.
 * En production, il faut le demander explicitement avec AUTH_DEV_CODES=1 : n'importe qui peut alors
 * se connecter avec n'importe quel email, donc à réserver à une adresse qui n'est pas encore partagée.
 */
export const showDevCode = () =>
  !process.env.RESEND_API_KEY && (process.env.NODE_ENV !== 'production' || process.env.AUTH_DEV_CODES === '1');

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

type Result = { ok: true; devCode?: string } | { ok: false; error: string };

export async function requestLoginCode(rawEmail: string): Promise<Result> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: 'Adresse email invalide.' };
  const email = parsed.data;

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(loginCodes)
    .where(and(eq(loginCodes.email, email), gt(loginCodes.createdAt, sql`now() - interval '1 hour'`)));
  if (n >= MAX_CODES_PER_HOUR) return { ok: false, error: 'Trop de demandes. Réessaie dans quelques minutes.' };

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  await db.insert(loginCodes).values({
    email,
    codeHash: codeHash(email, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000),
  });
  try {
    await sendMail(loginCodeMail(email, code));
  } catch {
    return { ok: false, error: "L'email n'a pas pu être envoyé. Réessaie dans un instant." };
  }
  return { ok: true, devCode: showDevCode() ? code : undefined };
}

export async function verifyLoginCode(rawEmail: string, rawCode: string): Promise<Result> {
  const parsed = emailSchema.safeParse(rawEmail);
  const code = rawCode.replace(/\D/g, '');
  if (!parsed.success || code.length !== 6) return { ok: false, error: 'Code incorrect.' };
  const email = parsed.data;

  const [row] = await db
    .select()
    .from(loginCodes)
    .where(and(eq(loginCodes.email, email), isNull(loginCodes.usedAt), gt(loginCodes.expiresAt, new Date())))
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);
  if (!row || row.attempts >= MAX_ATTEMPTS) return { ok: false, error: 'Code expiré. Demande un nouveau code.' };

  const a = Buffer.from(row.codeHash, 'hex');
  const b = Buffer.from(codeHash(email, code), 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await db.update(loginCodes).set({ attempts: row.attempts + 1 }).where(eq(loginCodes.id, row.id));
    return { ok: false, error: 'Code incorrect.' };
  }
  await db.update(loginCodes).set({ usedAt: new Date() }).where(eq(loginCodes.id, row.id));

  await db.insert(users).values({ email }).onConflictDoNothing({ target: users.email });
  const [user] = await db.select().from(users).where(eq(users.email, email));

  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: sha256(token), userId: user.id, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
  return { ok: true };
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

/** Utilisateur connecté, ou null. Mis en cache pour la durée de la requête. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email, firstName: users.firstName })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  return { ...row, isAdmin: adminEmails().includes(row.email) };
});

export async function requireUser(next = '/'): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?suite=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser('/admin');
  if (!user.isAdmin) notFound();
  return user;
}

/** Établissements dont l'utilisateur est membre (exploitant ou équipe) */
export const getMyVenues = cache(async (userId: string) => {
  return db
    .select({ venue: venues, role: venueMembers.role })
    .from(venueMembers)
    .innerJoin(venues, eq(venues.id, venueMembers.venueId))
    .where(eq(venueMembers.userId, userId))
    .orderBy(venues.createdAt);
});

/** Vérifie que l'utilisateur gère bien cet établissement, sinon 404 */
export async function requireVenueAccess(venueId: string, next = '/pro') {
  const user = await requireUser(next);
  const mine = await getMyVenues(user.id);
  const found = mine.find((m) => m.venue.id === venueId);
  if (!found && !user.isAdmin) notFound();
  return { user, venue: found?.venue, role: found?.role ?? 'owner' };
}
