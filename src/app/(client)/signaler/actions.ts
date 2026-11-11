'use server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { reports, venues } from '@/db/schema';
import { emailSchema, getCurrentUser } from '@/lib/auth';
import { reportAdminMail, sendMail } from '@/lib/email';
import { adminEmails } from '@/lib/env';
import { REPORT_REASONS } from './reasons';

export type ReportState = { ok?: boolean; error?: string; values?: Record<string, string> };

const schema = z.object({
  venue: z.string().trim().max(80).optional(),
  reason: z.enum(REPORT_REASONS, { message: 'Choisis un motif.' }),
  details: z.string().trim().min(20, 'Explique en quelques mots ce qui pose problème (20 caractères minimum).').max(2000),
  good: z.literal('on', { message: 'Confirme que ton signalement est fait de bonne foi.' }),
});

/** Signalement d'un contenu (règlement sur les services numériques, art. 16) : enregistré, l'équipe est prévenue, accusé de réception envoyé */
export async function reportAction(_prev: ReportState, form: FormData): Promise<ReportState> {
  const values = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, String(v)]));
  // Champ invisible : rempli seulement par les robots.
  if (values.site) return { ok: true };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const user = await getCurrentUser();
  let email = user?.email ?? null;
  if (!user) {
    const e = emailSchema.safeParse(values.email ?? '');
    if (!e.success) return { error: 'Indique ton email : on t’envoie notre décision.', values };
    email = e.data;
  }
  const d = parsed.data;
  const [venue] = d.venue ? await db.select({ id: venues.id, name: venues.name }).from(venues).where(eq(venues.slug, d.venue)) : [];
  const [r] = await db
    .insert(reports)
    .values({ venueId: venue?.id ?? null, reporterId: user?.id ?? null, email, reason: d.reason, details: d.details })
    .returning({ id: reports.id });
  const info = { id: r.id, reason: d.reason, details: d.details, venueName: venue?.name ?? null, email };
  await Promise.allSettled(adminEmails().map((to) => sendMail(reportAdminMail(to, info))));
  if (email) {
    await sendMail({
      to: email,
      subject: 'Signalement bien reçu',
      text: `Merci, on a bien reçu ton signalement${venue ? ` concernant ${venue.name}` : ''} (motif : ${d.reason}). On l’examine et tu recevras notre décision par email.`,
    }).catch(() => {});
  }
  return { ok: true };
}
