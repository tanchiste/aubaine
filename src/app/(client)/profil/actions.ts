'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { logout, requireUser } from '@/lib/auth';
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
