import 'server-only';
import crypto from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { loginCodes, sessions, users, venueMembers, venues, type AccountKind, type VenueCategory } from '@/db/schema';
import { loginCodeMail, sendMail } from './email';
import { adminCodesOnScreen, adminEmails, adminKey, isAdminEmail, testMode } from './env';

const SESSION_COOKIE = 'aub_session';
const SESSION_DAYS = 30;
const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;

export type CurrentUser = { id: string; email: string; firstName: string | null; kind: AccountKind; isAdmin: boolean };

/** Ce qu'on garde le temps que le nouvel inscrit tape son code */
export type SignupPayload = {
  kind: AccountKind;
  firstName: string;
  venue?: { name: string; category: VenueCategory; city: string };
};

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

/** Phase de test : sert aussi à afficher le bandeau « Version de test » */
export const showDevCode = testMode;
export { adminEmails, isAdminEmail };

type Result = { ok: true; devCode?: string; adminKey?: boolean } | { ok: false; error: string; reason?: 'no_account' | 'exists' };

/** Le code s'affiche à l'écran en phase de test, sauf pour l'équipe Aubaine en ligne */
const codeOnScreen = (admin: boolean) => testMode() && (!admin || adminCodesOnScreen());

/** Connexion admin avec la clé back-office : ni code à l'écran, ni service d'email configuré */
const usesAdminKey = (email: string) =>
  isAdminEmail(email) && !codeOnScreen(true) && !process.env.RESEND_API_KEY && adminKey() !== null;

/**
 * Envoie un code à 6 chiffres.
 * Connexion (sans `signup`) : le compte doit exister. Inscription : il ne doit pas exister.
 */
export async function requestLoginCode(rawEmail: string, signup?: SignupPayload): Promise<Result> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: 'Adresse email invalide.' };
  const email = parsed.data;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (signup && existing) return { ok: false, error: 'Un compte existe déjà avec cet email.', reason: 'exists' };
  const admin = isAdminEmail(email);
  if (!signup && !existing && !admin) return { ok: false, error: 'Aucun compte avec cet email.', reason: 'no_account' };
  const onScreen = codeOnScreen(admin);
  const keyMode = usesAdminKey(email);
  if (admin && !onScreen && !keyMode && !process.env.RESEND_API_KEY)
    return { ok: false, error: 'Accès au back-office : ajoute ADMIN_KEY (12 caractères minimum) dans Vercel, ou RESEND_API_KEY.' };

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(loginCodes)
    .where(and(eq(loginCodes.email, email), gt(loginCodes.createdAt, sql`now() - interval '1 hour'`)));
  if (n >= MAX_CODES_PER_HOUR) return { ok: false, error: 'Trop de demandes. Réessaie dans quelques minutes.' };

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  await db.insert(loginCodes).values({
    email,
    codeHash: codeHash(email, code),
    payload: signup ?? null,
    expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000),
  });
  if (!keyMode) {
    try {
      await sendMail(loginCodeMail(email, code));
    } catch {
      return { ok: false, error: "L'email n'a pas pu être envoyé. Réessaie dans un instant." };
    }
  }
  return { ok: true, devCode: onScreen ? code : undefined, adminKey: keyMode || undefined };
}

export type VerifyResult =
  | { ok: true; user: { id: string; kind: AccountKind }; created: boolean; signup: SignupPayload | null }
  | { ok: false; error: string };

export async function verifyLoginCode(rawEmail: string, rawCode: string): Promise<VerifyResult> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: 'Code incorrect.' };
  const email = parsed.data;
  const keyMode = usesAdminKey(email);
  const code = keyMode ? rawCode.trim() : rawCode.replace(/\D/g, '');
  if (!code || (!keyMode && code.length !== 6)) return { ok: false, error: keyMode ? 'Clé incorrecte.' : 'Code incorrect.' };

  const [row] = await db
    .select()
    .from(loginCodes)
    .where(and(eq(loginCodes.email, email), isNull(loginCodes.usedAt), gt(loginCodes.expiresAt, new Date())))
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);
  if (!row || row.attempts >= MAX_ATTEMPTS) return { ok: false, error: 'Code expiré. Demande un nouveau code.' };

  // Avec la clé back-office, on compare la clé saisie à ADMIN_KEY ; sinon le code au hash enregistré.
  const a = Buffer.from(keyMode ? sha256(adminKey()!) : row.codeHash, 'hex');
  const b = Buffer.from(keyMode ? sha256(code) : codeHash(email, code), 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await db.update(loginCodes).set({ attempts: row.attempts + 1 }).where(eq(loginCodes.id, row.id));
    return { ok: false, error: keyMode ? 'Clé incorrecte.' : 'Code incorrect.' };
  }
  await db.update(loginCodes).set({ usedAt: new Date() }).where(eq(loginCodes.id, row.id));

  const signup = (row.payload as SignupPayload | null) ?? null;
  const inserted = await db
    .insert(users)
    .values({ email, kind: signup?.kind ?? 'client', firstName: signup?.firstName || null })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
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
  return { ok: true, user: { id: user.id, kind: user.kind }, created: inserted.length > 0, signup: inserted.length > 0 ? signup : null };
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
    .select({ id: users.id, email: users.email, firstName: users.firstName, kind: users.kind })
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
