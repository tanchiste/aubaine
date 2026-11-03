'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users } from '@/db/schema';
import { logout, requireUser } from '@/lib/auth';

export async function saveNameAction(form: FormData) {
  const user = await requireUser('/profil');
  const firstName = String(form.get('firstName') ?? '').trim().slice(0, 40) || null;
  await db.update(users).set({ firstName }).where(eq(users.id, user.id));
  revalidatePath('/profil');
}

export async function logoutAction() {
  await logout();
  redirect('/');
}
