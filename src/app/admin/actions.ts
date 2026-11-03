'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db';
import { users, venueEvents, venueMembers, venuePhotos, venues } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { sendMail } from '@/lib/email';
import { checklist, isReady } from '@/lib/venues';

export type AdminState = { ok?: boolean; error?: string; message?: string };

async function load(venueId: string) {
  if (!z.uuid().safeParse(venueId).success) throw new Error('Fiche introuvable.');
  const [v] = await db.select().from(venues).where(eq(venues.id, venueId));
  if (!v) throw new Error('Fiche introuvable.');
  return v;
}

async function notifyOwners(venueId: string, subject: string, text: string) {
  const owners = await db.select({ email: users.email }).from(venueMembers).innerJoin(users, eq(users.id, venueMembers.userId)).where(eq(venueMembers.venueId, venueId));
  await Promise.allSettled(owners.map((o) => sendMail({ to: o.email, subject, text })));
}

export async function reviewAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  let done: { id: string; decision: string } | null = null;
  try {
    const admin = await requireAdmin();
    const v = await load(String(form.get('venueId')));
    const decision = String(form.get('decision'));
    const message = String(form.get('message') ?? '').trim().slice(0, 1000);
    const app = process.env.APP_URL ?? 'http://localhost:3000';

    if (decision === 'approve') {
      const photos = await db.select({ id: venuePhotos.id }).from(venuePhotos).where(eq(venuePhotos.venueId, v.id));
      if (!isReady(checklist(v, photos.length))) return { error: 'La checklist n’est pas complète.' };
      await db.update(venues).set({ status: 'published', publishedAt: new Date(), reviewMessage: null, updatedAt: new Date() }).where(eq(venues.id, v.id));
      await db.insert(venueEvents).values({ venueId: v.id, actorId: admin.id, action: 'approved', message: message || null });
      await notifyOwners(v.id, `${v.name} est en ligne sur Aubaine`, `Bonne nouvelle : ta fiche ${v.name} est en ligne.${message ? `\n\n${message}` : ''}\n\n${app}/pro`);
    } else if (decision === 'changes' || decision === 'reject') {
      if (message.length < 10) return { error: 'Écris un message à l’exploitant (10 caractères minimum).' };
      const status = decision === 'changes' ? 'changes_requested' : 'rejected';
      await db.update(venues).set({ status, reviewMessage: message, updatedAt: new Date() }).where(eq(venues.id, v.id));
      await db.insert(venueEvents).values({ venueId: v.id, actorId: admin.id, action: status, message });
      await notifyOwners(
        v.id,
        decision === 'changes' ? `Ta fiche ${v.name} : une correction avant la mise en ligne` : `Ta fiche ${v.name} n’a pas été retenue`,
        `${message}\n\n${app}/pro/etablissement`,
      );
    } else {
      return { error: 'Action inconnue.' };
    }
    revalidatePath('/admin');
    revalidatePath('/');
    done = { id: v.id, decision };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur inattendue.' };
  }
  redirect(`/admin?id=${done.id}&fait=${done.decision}`);
}
