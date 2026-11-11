import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { LazyMap, type MapPin } from '@/components/LazyMap';
import { VenueArt } from '@/components/ui';
import { CATEGORIES } from '@/lib/categories';
import { ago, brusselsDate, euros, longDate, timeLabel } from '@/lib/format';
import { firstPhotos } from '@/lib/venues';

type Row = {
  id: string;
  name: string;
  slug: string;
  category: keyof typeof CATEGORIES;
  city: string;
  color: string;
  lat: number | null;
  lng: number | null;
  base_discount_pct: number;
  published_at: Date | null;
  is_demo: boolean;
  open7: number;
  next_slot: Date | null;
  n30: number;
  cents30: number;
  last_booking: Date | null;
};

/** Établissements en ligne : carte, et pour chacun ses créneaux à venir et ses réservations des 30 derniers jours */
export async function OnlineView() {
  const rows = [
    ...(await db.execute<Row>(sql`
      select v.id, v.name, v.slug, v.category, v.city, v.color, v.lat, v.lng, v.base_discount_pct, v.published_at, v.is_demo,
        (select count(*)::int from slots s where s.venue_id = v.id and s.is_open and s.starts_at > now() and s.starts_at < now() + interval '7 days') as open7,
        (select min(s.starts_at) from slots s where s.venue_id = v.id and s.is_open and s.starts_at > now()) as next_slot,
        (select count(*)::int from bookings b where b.venue_id = v.id and b.status in ('confirmed', 'checked_in') and b.created_at > now() - interval '30 days') as n30,
        (select coalesce(sum(b.total_cents), 0)::int from bookings b where b.venue_id = v.id and b.status in ('confirmed', 'checked_in') and b.created_at > now() - interval '30 days') as cents30,
        (select max(b.created_at) from bookings b where b.venue_id = v.id and b.status <> 'pending') as last_booking
      from venues v
      where v.status = 'published'
      order by n30 desc, v.name`)),
  ];
  const covers = await firstPhotos(rows.map((r) => r.id));
  const pins: MapPin[] = rows
    .filter((r) => r.lat !== null && r.lng !== null)
    .map((r) => ({ id: r.id, lat: r.lat!, lng: r.lng!, name: r.name, pct: r.base_discount_pct, line: `${CATEGORIES[r.category].short} · ${r.city} · ${r.n30} rés. en 30 j`, href: `/lieu/${r.slug}` }));
  const empty = rows.filter((r) => r.open7 === 0);
  const cities = new Map<string, number>();
  rows.forEach((r) => cities.set(r.city, (cities.get(r.city) ?? 0) + 1));

  return (
    <>
      <section className="card stack" aria-labelledby="o-map" style={{ padding: '20px 22px', ['--gap' as string]: '12px' }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 6 }}>
          <h2 id="o-map" style={{ fontSize: 17, fontWeight: 800 }}>
            {rows.length} établissement{rows.length > 1 ? 's' : ''} en ligne dans {cities.size} commune{cities.size > 1 ? 's' : ''}
          </h2>
          <span className="small muted">{[...cities].map(([c, n]) => `${c} ${n}`).join(' · ')}</span>
        </div>
        {empty.length > 0 && (
          <p className="notice notice-amber small">
            Sans créneau dans les 7 prochains jours : {empty.map((r) => r.name).join(', ')}. Ils sont en ligne mais invisibles dans Explorer : relance-les.
          </p>
        )}
        {pins.length > 0 && <LazyMap pins={pins} className="admin-map" />}
      </section>

      <section className="card" aria-labelledby="o-list" style={{ padding: '8px 8px 4px', overflowX: 'auto' }}>
        <h2 id="o-list" style={{ fontSize: 16, fontWeight: 800, padding: '10px 12px' }}>Activité par établissement</h2>
        <table className="table">
          <thead>
            <tr><th>Établissement</th><th>Créneaux 7 j</th><th>Prochain créneau</th><th>Réservations 30 j</th><th>Montant 30 j</th><th>Dernière réservation</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="row" style={{ ['--gap' as string]: '10px' }}>
                    <VenueArt className="swatch" color={r.color} photoId={covers.get(r.id)} style={{ width: 34, height: 34, borderRadius: 9 }} />
                    <span>
                      <Link href={`/lieu/${r.slug}`} style={{ fontWeight: 700 }}>{r.name}</Link>
                      {r.is_demo && <span className="pill pill-muted" style={{ marginLeft: 6 }}>démo</span>}
                      <span className="small muted" style={{ display: 'block' }}>{CATEGORIES[r.category].short} · {r.city}</span>
                    </span>
                  </span>
                </td>
                <td className="tnum">{r.open7 === 0 ? <span className="pill pill-amber">aucun</span> : r.open7}</td>
                <td className="small">{r.next_slot ? `${longDate(brusselsDate(new Date(r.next_slot)))}, ${timeLabel(new Date(r.next_slot))}` : '–'}</td>
                <td className="tnum">{r.n30}</td>
                <td className="tnum">{euros(r.cents30)}</td>
                <td className="small muted">{r.last_booking ? ago(new Date(r.last_booking)) : 'jamais'}</td>
                <td><Link className="small" href={`/admin?id=${r.id}`}>Détail</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
