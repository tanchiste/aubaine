'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db';
import { users, venueMembers, venues } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { payoutMail, sendMail } from '@/lib/email';
import { monthLabel, PayoutError, recordPayout } from '@/lib/payouts';

export type PayoutState = { ok?: boolean; error?: string };

/** Le virement est parti depuis le compte d'Aubaine : on l'enregistre et on prévient les gérants */
export async function markPaidAction(_prev: PayoutState, form: FormData): Promise<PayoutState> {
  const admin = await requireAdmin();
  const venueId = String(form.get('venueId') ?? '');
  const month = String(form.get('month') ?? '');
  const reference = String(form.get('reference') ?? '').trim().slice(0, 140) || null;
  if (!z.uuid().safeParse(venueId).success) return { error: 'Établissement introuvable.' };
  try {
    const payout = await recordPayout(venueId, month, admin.id, reference);
    const [venue] = await db.select().from(venues).where(eq(venues.id, venueId));
    const owners = await db
      .select({ email: users.email, role: venueMembers.role })
      .from(venueMembers)
      .innerJoin(users, eq(users.id, venueMembers.userId))
      .where(eq(venueMembers.venueId, venueId));
    await Promise.allSettled(owners.filter((o) => o.role === 'owner').map((o) => sendMail(payoutMail(venue, payout, monthLabel(month), o.email))));
    revalidatePath('/admin/virements');
    return { ok: true };
  } catch (e) {
    if (e instanceof PayoutError) return { error: e.message };
    console.error('[virements]', e);
    return { error: 'Enregistrement impossible. Réessaie.' };
  }
}
