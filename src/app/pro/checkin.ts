'use server';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { checkIn } from '@/lib/bookings';
import { getProContext } from '@/lib/pro';

export type CheckInState = { ok?: boolean; error?: string; message?: string };

export async function checkInCodeAction(_prev: CheckInState, form: FormData): Promise<CheckInState> {
  const { current } = await getProContext();
  if (!current) return { error: 'Aucun établissement.' };
  const r = await checkIn(current.venue.id, { code: String(form.get('code') ?? '') });
  if (!r.ok) return { error: r.error };
  revalidatePath('/pro');
  return { ok: true, message: `${r.name} validé, ${r.people} pers. Bonne séance !` };
}

export async function checkInIdAction(form: FormData) {
  const { current } = await getProContext();
  if (!current) return;
  await checkIn(current.venue.id, { id: String(form.get('bookingId') ?? '') });
  revalidatePath('/pro');
}

/** Le client ne s'est pas présenté : possible une fois le créneau commencé */
export async function noShowAction(form: FormData) {
  const { current } = await getProContext();
  if (!current) return;
  const id = String(form.get('bookingId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await db.execute(sql`
    update bookings b set status = 'no_show'
    from slots s
    where b.id = ${id}::uuid and b.venue_id = ${current.venue.id} and b.status = 'confirmed'
      and s.id = b.slot_id and s.starts_at < now()`);
  revalidatePath('/pro');
}
