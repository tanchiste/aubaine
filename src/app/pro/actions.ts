'use server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db';
import { venueEvents, venueMembers, venuePhotos, venues, type VenueCategory } from '@/db/schema';
import { adminEmails, getMyVenues, requireUser } from '@/lib/auth';
import { CATEGORY_KEYS, VENUE_COLORS } from '@/lib/categories';
import { sendMail } from '@/lib/email';
import { MAX_DISCOUNT, MIN_DISCOUNT } from '@/lib/pricing';
import { VENUE_COOKIE, slugify } from '@/lib/pro';
import { checklist, isReady } from '@/lib/venues';

const MAX_PHOTOS = 8;
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const PHOTO_TYPES = ['image/webp', 'image/jpeg', 'image/png'];

/** Vérifie que l'utilisateur gère cet établissement (ou est admin) et le renvoie */
async function ownVenue(venueId: string) {
  const user = await requireUser('/pro');
  if (!z.uuid().safeParse(venueId).success) throw new Error('Établissement introuvable.');
  const mine = await getMyVenues(user.id);
  const m = mine.find((x) => x.venue.id === venueId);
  if (m) return { user, venue: m.venue };
  if (user.isAdmin) {
    const [v] = await db.select().from(venues).where(eq(venues.id, venueId));
    if (v) return { user, venue: v };
  }
  throw new Error('Établissement introuvable.');
}

/** Réglages de départ selon le type d'activité, modifiables ensuite */
const DEFAULTS: Record<VenueCategory, { durationMin: number; groupMin: number; groupMax: number; capacity: number; capacityUnit: 'places' | 'groupes'; priceUnit: 'person' | 'session' }> = {
  escape: { durationMin: 60, groupMin: 2, groupMax: 6, capacity: 1, capacityUnit: 'groupes', priceUnit: 'person' },
  karting: { durationMin: 15, groupMin: 1, groupMax: 12, capacity: 8, capacityUnit: 'places', priceUnit: 'person' },
  laser: { durationMin: 20, groupMin: 4, groupMax: 20, capacity: 20, capacityUnit: 'places', priceUnit: 'person' },
  vr: { durationMin: 30, groupMin: 1, groupMax: 8, capacity: 8, capacityUnit: 'places', priceUnit: 'person' },
  bowling: { durationMin: 45, groupMin: 1, groupMax: 6, capacity: 4, capacityUnit: 'groupes', priceUnit: 'person' },
  hache: { durationMin: 60, groupMin: 2, groupMax: 8, capacity: 2, capacityUnit: 'groupes', priceUnit: 'person' },
  bienetre: { durationMin: 120, groupMin: 1, groupMax: 2, capacity: 1, capacityUnit: 'groupes', priceUnit: 'session' },
  autre: { durationMin: 60, groupMin: 1, groupMax: 10, capacity: 10, capacityUnit: 'places', priceUnit: 'person' },
};

export type FormState = { ok?: boolean; error?: string; message?: string };

/* ---------- Inscription ---------- */

const createSchema = z.object({
  name: z.string().trim().min(2, 'Le nom est trop court.').max(60),
  category: z.enum(CATEGORY_KEYS as [VenueCategory, ...VenueCategory[]], { message: 'Choisis une activité.' }),
  city: z.string().trim().min(2, 'Indique la commune.').max(40),
});

export async function createVenueAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser('/pro');
  const parsed = createSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, category, city } = parsed.data;

  let slug = slugify(name);
  const taken = await db.select({ slug: venues.slug }).from(venues).where(sql`${venues.slug} like ${slug + '%'}`);
  if (taken.some((t) => t.slug === slug)) {
    let i = 2;
    while (taken.some((t) => t.slug === `${slug}-${i}`)) i++;
    slug = `${slug}-${i}`;
  }

  const color = VENUE_COLORS[Math.floor(Math.random() * VENUE_COLORS.length)];
  const [v] = await db
    .insert(venues)
    .values({ slug, name, category, city, color, ...DEFAULTS[category], priceCents: 0, baseDiscountPct: 25 })
    .returning({ id: venues.id });
  await db.insert(venueMembers).values({ venueId: v.id, userId: user.id, role: 'owner' });
  await db.insert(venueEvents).values({ venueId: v.id, actorId: user.id, action: 'created' });
  (await cookies()).set(VENUE_COOKIE, v.id, { path: '/', sameSite: 'lax', httpOnly: true, maxAge: 31536000 });
  redirect('/pro/etablissement?nouveau=1');
}

export async function switchVenueAction(form: FormData) {
  const { venue } = await ownVenue(String(form.get('venueId')));
  (await cookies()).set(VENUE_COOKIE, venue.id, { path: '/', sameSite: 'lax', httpOnly: true, maxAge: 31536000 });
  revalidatePath('/pro', 'layout');
}

/* ---------- Fiche ---------- */

const euros = z
  .string()
  .trim()
  .transform((s, ctx) => {
    const n = Number(s.replace(',', '.').replace(/[^\d.]/g, ''));
    if (!s || !Number.isFinite(n) || n < 1) {
      ctx.addIssue({ code: 'custom', message: 'Le prix doit être d’au moins 1 €.' });
      return z.NEVER;
    }
    if (n > 2000) {
      ctx.addIssue({ code: 'custom', message: 'Prix trop élevé.' });
      return z.NEVER;
    }
    return Math.round(n * 100);
  });

const int = (min: number, max: number, label: string) =>
  z.coerce.number({ message: `${label} invalide.` }).int(`${label} invalide.`).min(min, `${label} : minimum ${min}.`).max(max, `${label} : maximum ${max}.`);

const venueSchema = z
  .object({
    name: z.string().trim().min(2, 'Le nom est trop court.').max(60),
    category: z.enum(CATEGORY_KEYS as [VenueCategory, ...VenueCategory[]]),
    city: z.string().trim().min(2, 'Indique la commune.').max(40),
    area: z.string().trim().max(40).optional().transform((s) => s || null),
    address: z.string().trim().max(120).optional().transform((s) => s || null),
    description: z.string().trim().max(800, 'Description trop longue (800 caractères maximum).').optional().transform((s) => s || null),
    durationMin: int(5, 480, 'Durée'),
    groupMin: int(1, 50, 'Groupe minimum'),
    groupMax: int(1, 100, 'Groupe maximum'),
    capacity: int(1, 200, 'Capacité'),
    capacityUnit: z.enum(['places', 'groupes']),
    price: euros,
    priceUnit: z.enum(['person', 'session']),
    baseDiscountPct: int(MIN_DISCOUNT, MAX_DISCOUNT, 'Remise'),
    color: z.string().refine((c) => VENUE_COLORS.includes(c), 'Couleur invalide.'),
  })
  .refine((d) => d.groupMin <= d.groupMax, { message: 'Le groupe minimum dépasse le maximum.' });

export async function saveVenueAction(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { venue } = await ownVenue(String(form.get('venueId')));
    if (venue.status === 'rejected') return { error: 'Cette fiche a été refusée : contacte-nous pour en discuter.' };
    const parsed = venueSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { price, ...data } = parsed.data;
    await db
      .update(venues)
      .set({ ...data, priceCents: price, updatedAt: new Date() })
      .where(eq(venues.id, venue.id));
    revalidatePath('/pro', 'layout');
    return { ok: true, message: 'Fiche enregistrée.' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur inattendue.' };
  }
}

/* ---------- Photos ---------- */

export async function uploadPhotoAction(form: FormData): Promise<FormState> {
  try {
    const { venue } = await ownVenue(String(form.get('venueId')));
    const file = form.get('file');
    if (!(file instanceof File)) return { error: 'Aucune photo reçue.' };
    if (!PHOTO_TYPES.includes(file.type)) return { error: 'Format non accepté (JPEG, PNG ou WebP).' };
    if (file.size > MAX_PHOTO_BYTES) return { error: 'Photo trop lourde (3 Mo maximum).' };
    const [{ n, maxPos }] = await db
      .select({ n: sql<number>`count(*)::int`, maxPos: sql<number>`coalesce(max(${venuePhotos.position}), -1)::int` })
      .from(venuePhotos)
      .where(eq(venuePhotos.venueId, venue.id));
    if (n >= MAX_PHOTOS) return { error: `${MAX_PHOTOS} photos maximum.` };
    const dim = (k: string) => {
      const v = parseInt(String(form.get(k) ?? ''), 10);
      return Number.isFinite(v) && v > 0 && v < 10000 ? v : null;
    };
    await db.insert(venuePhotos).values({
      venueId: venue.id,
      position: maxPos + 1,
      mime: file.type,
      width: dim('width'),
      height: dim('height'),
      data: Buffer.from(await file.arrayBuffer()),
    });
    revalidatePath('/pro', 'layout');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur inattendue.' };
  }
}

async function ownPhoto(photoId: string) {
  if (!z.uuid().safeParse(photoId).success) throw new Error('Photo introuvable.');
  const [p] = await db.select({ venueId: venuePhotos.venueId }).from(venuePhotos).where(eq(venuePhotos.id, photoId));
  if (!p) throw new Error('Photo introuvable.');
  return ownVenue(p.venueId);
}

export async function deletePhotoAction(form: FormData) {
  const id = String(form.get('photoId'));
  await ownPhoto(id);
  await db.delete(venuePhotos).where(eq(venuePhotos.id, id));
  revalidatePath('/pro', 'layout');
}

export async function makeCoverAction(form: FormData) {
  const id = String(form.get('photoId'));
  const { venue } = await ownPhoto(id);
  const [{ minPos }] = await db
    .select({ minPos: sql<number>`coalesce(min(${venuePhotos.position}), 0)::int` })
    .from(venuePhotos)
    .where(eq(venuePhotos.venueId, venue.id));
  await db.update(venuePhotos).set({ position: minPos - 1 }).where(eq(venuePhotos.id, id));
  revalidatePath('/pro', 'layout');
}

/* ---------- Validation ---------- */

export async function submitVenueAction(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    await doSubmit(String(form.get('venueId')));
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur inattendue.' };
  }
  redirect('/pro/etablissement?envoye=1');
}

async function doSubmit(venueId: string) {
  {
    const { user, venue } = await ownVenue(venueId);
    if (!['draft', 'changes_requested'].includes(venue.status)) throw new Error('Cette fiche ne peut pas être envoyée maintenant.');
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(venuePhotos).where(eq(venuePhotos.venueId, venue.id));
    if (!isReady(checklist(venue, n))) throw new Error('Il manque encore des éléments : regarde la liste ci-dessus.');
    await db
      .update(venues)
      .set({ status: 'submitted', submittedAt: new Date(), reviewMessage: null, updatedAt: new Date() })
      .where(and(eq(venues.id, venue.id), inArray(venues.status, ['draft', 'changes_requested'])));
    await db.insert(venueEvents).values({ venueId: venue.id, actorId: user.id, action: 'submitted' });
    const app = process.env.APP_URL ?? 'http://localhost:3000';
    await Promise.allSettled(
      adminEmails().map((to) =>
        sendMail({ to, subject: `Nouvelle fiche à valider : ${venue.name}`, text: `${venue.name} (${venue.city}) attend ta validation.\n\n${app}/admin?id=${venue.id}` }),
      ),
    );
    revalidatePath('/pro', 'layout');
    revalidatePath('/admin');
  }
}

export async function togglePauseAction(form: FormData) {
  const { user, venue } = await ownVenue(String(form.get('venueId')));
  if (venue.status !== 'published' && venue.status !== 'paused') return;
  const next = venue.status === 'published' ? 'paused' : 'published';
  await db.update(venues).set({ status: next, updatedAt: new Date() }).where(eq(venues.id, venue.id));
  await db.insert(venueEvents).values({ venueId: venue.id, actorId: user.id, action: next === 'paused' ? 'paused' : 'resumed' });
  revalidatePath('/pro', 'layout');
  revalidatePath('/');
}
