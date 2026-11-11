import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { checkSmtp } from '@/lib/email';
import { companyReady } from '@/lib/legal';

/**
 * Page de contrôle : /api/sante indique si l'app joint la base et quels services sont configurés
 * (jamais les valeurs secrètes). /api/sante?verifier=email teste aussi la connexion au serveur d'emails.
 */
export async function GET(req: Request) {
  const env = process.env;
  const config = {
    emails: env.SMTP_URL ? 'smtp' : env.RESEND_API_KEY ? 'resend' : 'non configurés (codes dans les logs)',
    rappelsQuotidiens: env.CRON_SECRET ? 'configurés' : 'CRON_SECRET absent',
    paiements: env.STRIPE_SECRET_KEY ? (env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'Stripe (réels)' : 'Stripe (test)') : 'simulés',
    ...(env.STRIPE_SECRET_KEY
      ? {
          webhookPaiements: env.STRIPE_WEBHOOK_SECRET ? 'configuré' : 'STRIPE_WEBHOOK_SECRET absent',
          webhookComptesExploitants: env.STRIPE_CONNECT_WEBHOOK_SECRET ? 'configuré' : 'STRIPE_CONNECT_WEBHOOK_SECRET absent (état relu à chaque visite de la page Paiements)',
        }
      : {}),
    codesAffichesALEcran: env.AUTH_DEV_CODES === '1',
    mentionsLegales: companyReady() ? 'complètes' : 'à compléter',
  };
  const smtp = new URL(req.url).searchParams.get('verifier') === 'email' ? await checkSmtp() : undefined;
  try {
    const rows = await db.execute<{ venues: number; slots: number }>(
      sql`select (select count(*)::int from venues where status = 'published') as venues,
                 (select count(*)::int from slots where starts_at > now()) as slots`,
    );
    const [r] = [...rows];
    return Response.json({ ok: true, base: 'connectée', etablissementsEnLigne: r.venues, creneauxAVenir: r.slots, config, ...(smtp ? { smtp } : {}) });
  } catch (e) {
    console.error('[sante]', e);
    return Response.json({ ok: false, base: 'injoignable', config, ...(smtp ? { smtp } : {}) }, { status: 503 });
  }
}
