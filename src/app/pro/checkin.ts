'use server';
import { revalidatePath } from 'next/cache';
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
