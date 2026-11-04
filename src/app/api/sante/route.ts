import { sql } from 'drizzle-orm';
import { db } from '@/db';

/** Page de contrôle : /api/sante indique si l'app joint bien la base de données */
export async function GET() {
  try {
    const rows = await db.execute<{ venues: number; slots: number }>(
      sql`select (select count(*)::int from venues where status = 'published') as venues,
                 (select count(*)::int from slots where starts_at > now()) as slots`,
    );
    const [r] = [...rows];
    return Response.json({ ok: true, base: 'connectée', etablissementsEnLigne: r.venues, creneauxAVenir: r.slots });
  } catch (e) {
    console.error('[sante]', e);
    return Response.json({ ok: false, base: 'injoignable' }, { status: 503 });
  }
}
