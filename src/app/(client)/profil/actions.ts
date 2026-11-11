'use server';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db';
import { bookings, loginCodes, reports, sessions, slots, users, venueMembers, venues } from '@/db/schema';
import { logout, requireUser } from '@/lib/auth';
import { sendMail } from '@/lib/email';
import { CITY_COOKIE } from '@/lib/params';

export type ProfileState = { ok?: boolean; error?: string };

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((s) => s || null);

const schema = z.object({
  firstName: z.string().trim().min(1, 'Le prénom est obligatoire.').max(40),
  lastName: opt(40),
  phone: opt(20).refine((s) => !s || /^[+0-9 ().\/-]{6,20}$/.test(s), 'Numéro de téléphone invalide.'),
  city: opt(40),
});

export async function saveProfileAction(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await requireUser('/profil');
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.update(users).set(parsed.data).where(eq(users.id, user.id));
  // La ville préférée devient la ville par défaut d'Explorer.
  (await cookies()).set(CITY_COOKIE, encodeURIComponent(parsed.data.city ?? 'tout'), { path: '/', sameSite: 'lax', maxAge: 31536000 });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function logoutAction() {
  await logout();
  redirect('/');
}

export type DeleteState = { error?: string };

/**
 * Suppression du compte (droit à l'effacement) : les données personnelles sont effacées,
 * les réservations passées restent, sans lien avec la personne, pour la comptabilité.
 */
export async function deleteAccountAction(_prev: DeleteState, form: FormData): Promise<DeleteState> {
  const user = await requireUser('/profil');
  if (String(form.get('confirm') ?? '').trim().toUpperCase() !== 'SUPPRIMER') return { error: 'Tape SUPPRIMER pour confirmer.' };

  const [{ upcoming }] = await db
    .select({ upcoming: sql<number>`count(*)::int` })
    .from(bookings)
    .innerJoin(slots, eq(slots.id, bookings.slotId))
    .where(and(eq(bookings.userId, user.id), inArray(bookings.status, ['confirmed', 'pending']), gt(slots.startsAt, new Date())));
  if (upcoming > 0)
    return { error: `Tu as ${upcoming} réservation${upcoming > 1 ? 's' : ''} à venir : annule-${upcoming > 1 ? 'les' : 'la'} d’abord depuis Billets, ou attends qu’elle${upcoming > 1 ? 's soient passées' : ' soit passée'}.` };

  // Un établissement doit toujours garder un gérant.
  const owned = await db
    .select({ venueId: venueMembers.venueId, name: venues.name, owners: sql<number>`(select count(*) from venue_members m where m.venue_id = ${venueMembers.venueId} and m.role = 'owner')::int` })
    .from(venueMembers)
    .innerJoin(venues, eq(venues.id, venueMembers.venueId))
    .where(and(eq(venueMembers.userId, user.id), eq(venueMembers.role, 'owner')));
  const alone = owned.find((o) => o.owners <= 1);
  if (alone) return { error: `Tu es le seul gérant de ${alone.name} : nomme un autre gérant dans Équipe, ou écris-nous pour fermer la fiche.` };

  const email = user.email;
  await db.transaction(async (tx) => {
    await tx.delete(venueMembers).where(eq(venueMembers.userId, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await tx.delete(loginCodes).where(eq(loginCodes.email, email));
    await tx.update(reports).set({ reporterId: null, email: null }).where(eq(reports.reporterId, user.id));
    await tx
      .update(users)
      .set({ email: `supprime-${user.id}@aubaine.invalid`, firstName: null, lastName: null, phone: null, city: null, referralCode: null, deletedAt: new Date() })
      .where(eq(users.id, user.id));
  });
  await sendMail({
    to: email,
    subject: 'Ton compte Aubaine est supprimé',
    text: 'Ton compte Aubaine est supprimé, comme tu l’as demandé. Tes données personnelles sont effacées ; seules tes réservations passées restent, sans lien avec toi, pour notre comptabilité.\n\nÀ bientôt peut-être !',
  }).catch(() => {});
  (await cookies()).delete('aub_session');
  redirect('/profil?supprime=1');
}
