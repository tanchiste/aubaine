import { housekeeping, sendReminders, sendVenueDigests } from '@/lib/notify';

// Peut prendre un moment s'il y a beaucoup de rappels à envoyer.
export const maxDuration = 60;

/**
 * Tâche quotidienne lancée par Vercel (vercel.json, 16 h UTC) : rappels aux clients pour demain,
 * récap de demain aux établissements, ménage des données expirées.
 * Vercel envoie « Authorization: Bearer CRON_SECRET » : sans ce secret, personne d'autre ne peut la déclencher.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Non autorisé', { status: 401 });
  const reminders = await sendReminders();
  const digests = await sendVenueDigests();
  const cleaned = await housekeeping();
  console.log('[cron] quotidien', { reminders, digests, cleaned });
  return Response.json({ reminders, digests, cleaned });
}
