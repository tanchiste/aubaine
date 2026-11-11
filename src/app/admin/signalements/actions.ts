'use server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db';
import { reports, users, venueEvents, venueMembers, venues } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { reportDecisionMail, sendMail } from '@/lib/email';

export type DecideState = { ok?: boolean; error?: string };

/**
 * Décision sur un signalement, toujours motivée (règlement sur les services numériques, art. 17) :
 * la personne qui a signalé reçoit la décision ; si la fiche est mise en pause, l'exploitant reçoit les motifs.
 */
export async function decideReportAction(_prev: DecideState, form: FormData): Promise<DecideState> {
  const admin = await requireAdmin();
  const id = String(form.get('reportId') ?? '');
  if (!z.uuid().safeParse(id).success) return { error: 'Signalement introuvable.' };
  const status = form.get('decision') === 'dismissed' ? 'dismissed' : 'resolved';
  const resolution = String(form.get('resolution') ?? '').trim().slice(0, 1000);
  if (resolution.length < 10) return { error: 'Écris la décision et ses motifs (10 caractères minimum) : elle est envoyée à la personne qui a signalé.' };
  const pause = form.get('pause') === 'on';

  const [r] = await db
    .update(reports)
    .set({ status, resolution, resolvedBy: admin.id, resolvedAt: new Date() })
    .where(and(eq(reports.id, id), eq(reports.status, 'open')))
    .returning();
  if (!r) return { error: 'Ce signalement a déjà été traité.' };
  const [venue] = r.venueId ? await db.select().from(venues).where(eq(venues.id, r.venueId)) : [];

  if (pause && venue && venue.status === 'published') {
    await db.update(venues).set({ status: 'paused', updatedAt: new Date() }).where(eq(venues.id, venue.id));
    await db.insert(venueEvents).values({ venueId: venue.id, actorId: admin.id, action: 'paused_after_report', message: resolution });
    const owners = await db.select({ email: users.email }).from(venueMembers).innerJoin(users, eq(users.id, venueMembers.userId)).where(eq(venueMembers.venueId, venue.id));
    const app = process.env.APP_URL ?? 'http://localhost:3000';
    await Promise.allSettled(
      owners.map((o) =>
        sendMail({
          to: o.email,
          subject: `${venue.name} est mise en pause sur Aubaine`,
          text: `Suite à un signalement, ta fiche ${venue.name} est mise en pause : elle n’apparaît plus dans l’app. Les réservations déjà confirmées restent valables.\n\nMotif : ${resolution}\n\nTu peux contester cette décision ou nous dire ce que tu as corrigé en répondant à cet email.\n\n${app}/pro/etablissement`,
        }),
      ),
    );
    revalidatePath('/');
  }
  if (r.email) await sendMail(reportDecisionMail(r.email, resolution, venue?.name ?? null)).catch(() => {});
  revalidatePath('/admin', 'layout');
  return { ok: true };
}
