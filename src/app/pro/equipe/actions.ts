'use server';
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db';
import { users, venueMembers } from '@/db/schema';
import { emailSchema } from '@/lib/auth';
import { sendMail } from '@/lib/email';
import { getProContext } from '@/lib/pro';

export type TeamState = { ok?: boolean; error?: string; message?: string };

async function ownerContext() {
  const ctx = await getProContext('/pro/equipe');
  if (!ctx.current || (ctx.role !== 'owner' && !ctx.user.isAdmin)) throw new Error('Réservé au gérant.');
  return { user: ctx.user, venue: ctx.current.venue };
}

const inviteSchema = z.object({
  email: emailSchema,
  firstName: z.string().trim().max(40).optional(),
  role: z.enum(['owner', 'staff']),
});

/** Ajoute quelqu'un à l'équipe. Son compte est créé s'il n'existe pas : il se connecte ensuite avec son email. */
export async function inviteAction(_prev: TeamState, form: FormData): Promise<TeamState> {
  try {
    const { user, venue } = await ownerContext();
    const parsed = inviteSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { email, firstName, role } = parsed.data;
    await db.insert(users).values({ email, kind: 'exploitant', firstName: firstName || null }).onConflictDoNothing({ target: users.email });
    const [u] = await db.select().from(users).where(eq(users.email, email));
    if (u.kind === 'client') await db.update(users).set({ kind: 'exploitant' }).where(eq(users.id, u.id));
    // Les emails de réservation vont au gérant ; l'accueil peut les recevoir aussi si le gérant l'active.
    const added = await db.insert(venueMembers).values({ venueId: venue.id, userId: u.id, role, notify: role === 'owner' }).onConflictDoNothing().returning();
    if (added.length === 0) return { error: 'Cette personne fait déjà partie de l’équipe.' };
    const app = process.env.APP_URL ?? 'http://localhost:3000';
    const what = role === 'owner' ? 'gérant' : 'à l’accueil';
    await sendMail({
      to: email,
      subject: `${user.firstName ?? 'Ton équipe'} t’ajoute à ${venue.name} sur Aubaine`,
      text: `Tu fais maintenant partie de l’équipe de ${venue.name} (${what}).\n\nConnecte-toi avec cet email, sans mot de passe : ${app}/connexion?suite=/pro`,
    }).catch(() => {});
    revalidatePath('/pro/equipe');
    return { ok: true, message: `${firstName || email} ajouté${role === 'owner' ? ' comme gérant' : ' à l’accueil'}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur inattendue.' };
  }
}

async function owners(venueId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(venueMembers)
    .where(and(eq(venueMembers.venueId, venueId), eq(venueMembers.role, 'owner')));
  return n;
}

export async function setRoleAction(form: FormData) {
  const { venue } = await ownerContext();
  const userId = String(form.get('userId'));
  const role = form.get('role') === 'owner' ? 'owner' : 'staff';
  if (!z.uuid().safeParse(userId).success) return;
  // Il faut toujours au moins un gérant.
  if (role === 'staff' && (await owners(venue.id)) <= 1) {
    const [m] = await db.select().from(venueMembers).where(and(eq(venueMembers.venueId, venue.id), eq(venueMembers.userId, userId)));
    if (m?.role === 'owner') return;
  }
  await db.update(venueMembers).set({ role }).where(and(eq(venueMembers.venueId, venue.id), eq(venueMembers.userId, userId)));
  revalidatePath('/pro', 'layout');
}

export async function removeMemberAction(form: FormData) {
  const { user, venue } = await ownerContext();
  const userId = String(form.get('userId'));
  if (!z.uuid().safeParse(userId).success || userId === user.id) return;
  await db.delete(venueMembers).where(and(eq(venueMembers.venueId, venue.id), eq(venueMembers.userId, userId)));
  revalidatePath('/pro/equipe');
}

/** Emails de réservation, d'annulation et récap de la veille : par membre, au choix du gérant */
export async function toggleNotifyAction(form: FormData) {
  const { venue } = await ownerContext();
  const userId = String(form.get('userId'));
  if (!z.uuid().safeParse(userId).success) return;
  const notify = form.get('notify') === 'on';
  await db.update(venueMembers).set({ notify }).where(and(eq(venueMembers.venueId, venue.id), eq(venueMembers.userId, userId)));
  revalidatePath('/pro/equipe');
}
