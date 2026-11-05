/**
 * Données de démonstration (établissements fictifs).
 * Relançable sans risque : supprime puis recrée tout ce qui est marqué is_demo.
 * À ne PAS lancer sur la base de production une fois le pilote démarré.
 */
import postgres from 'postgres';

type Demo = {
  slug: string;
  name: string;
  category: string;
  city: string;
  area: string;
  address: string;
  description: string;
  durationMin: number;
  groupMin: number;
  groupMax: number;
  capacity: number;
  capacityUnit: 'places' | 'groupes';
  price: number;
  priceUnit: 'person' | 'session';
  discount: number;
  color: string;
  status?: 'published' | 'submitted';
  /** nom de la prestation principale */
  offer: string;
  /** heures des créneaux creux en semaine, avec leur remise */
  times: [string, number][];
  /** autres prestations du même lieu */
  more?: Extra[];
};

type Extra = Pick<Demo, 'durationMin' | 'groupMin' | 'groupMax' | 'capacity' | 'capacityUnit' | 'price' | 'priceUnit' | 'times'> & { name: string; description?: string };

const DEMOS: Demo[] = [
  {
    slug: 'kartohm', name: "Kart'Ohm", category: 'karting', city: 'Mons', area: 'Jemappes',
    address: 'Rue du Grand Large 12, 7012 Jemappes',
    description: 'Karting électrique indoor sur une piste de 500 m. Sessions de 15 minutes, chronos affichés en direct.',
    durationMin: 15, groupMin: 1, groupMax: 12, capacity: 8, capacityUnit: 'places', price: 22, priceUnit: 'person',
    discount: 35, color: '#E89A00', offer: 'Session 15 min', times: [['13:00', 40], ['14:00', 35], ['15:00', 35], ['16:00', 35], ['17:00', 30]],
    more: [
      { name: 'Grand Prix 30 min', description: 'Qualifications puis course avec podium.', durationMin: 30, groupMin: 4, groupMax: 12, capacity: 8, capacityUnit: 'places', price: 39, priceUnit: 'person', times: [['14:30', 30], ['16:30', 30]] },
    ],
  },
  {
    slug: 'le-cachot', name: 'Le Cachot', category: 'escape', city: 'Mons', area: 'Centre-ville',
    address: 'Rue des Clercs 8, 7000 Mons',
    description: "Deux salles de 60 minutes dans d'anciennes caves voûtées : une évasion de prison et un laboratoire abandonné.",
    durationMin: 60, groupMin: 2, groupMax: 6, capacity: 1, capacityUnit: 'groupes', price: 26, priceUnit: 'person',
    discount: 40, color: '#5B2A86', offer: 'Salle « La Prison »', times: [['14:00', 40], ['16:00', 40], ['18:00', 25]],
    more: [
      { name: 'Salle « Le Labo »', description: 'Un laboratoire abandonné, niveau confirmé.', durationMin: 60, groupMin: 2, groupMax: 6, capacity: 1, capacityUnit: 'groupes', price: 26, priceUnit: 'person', times: [['14:30', 40], ['16:30', 35]] },
    ],
  },
  {
    slug: 'nebula-vr', name: 'Nébula VR', category: 'vr', city: 'Mons', area: 'Les Grands Prés',
    address: 'Place des Grands Prés 3, 7000 Mons',
    description: "Arène de réalité virtuelle en libre déplacement : jusqu'à 8 joueurs dans la même partie, sans câble.",
    durationMin: 30, groupMin: 1, groupMax: 8, capacity: 8, capacityUnit: 'places', price: 20, priceUnit: 'person',
    discount: 30, color: '#2B8C9E', offer: 'Partie 30 min', times: [['12:30', 30], ['14:30', 30], ['16:30', 30], ['19:00', 25]],
  },
  {
    slug: 'arena-laser-borinage', name: 'Arena Laser Borinage', category: 'laser', city: 'Mons', area: 'Ghlin',
    address: 'Rue de la Libération 40, 7011 Ghlin',
    description: 'Labyrinthe de 600 m² sur deux niveaux, gilets sans fil et scores affichés sur écran géant.',
    durationMin: 20, groupMin: 4, groupMax: 20, capacity: 20, capacityUnit: 'places', price: 13, priceUnit: 'person',
    discount: 30, color: '#1F6F8B', offer: 'Partie 20 min', times: [['14:00', 30], ['15:00', 30], ['16:00', 25]],
  },
  {
    slug: 'strike-7000', name: 'Strike 7000', category: 'bowling', city: 'Mons', area: 'Mons Est',
    address: 'Avenue du Champ de Bataille 5, 7000 Mons',
    description: 'Huit pistes, chaussures comprises, et un bar à cocktails sans alcool pour patienter.',
    durationMin: 45, groupMin: 1, groupMax: 6, capacity: 8, capacityUnit: 'groupes', price: 9, priceUnit: 'person',
    discount: 30, color: '#CF3520', offer: 'Partie 45 min', times: [['13:00', 30], ['14:00', 30], ['15:00', 25]],
  },
  {
    slug: 'bulle-d-o', name: "Bulle d'O", category: 'bienetre', city: 'La Louvière', area: 'Centre',
    address: 'Rue Albert Ier 21, 7100 La Louvière',
    description: 'Espace bien-être privatisé pour deux : jacuzzi, sauna infrarouge et douche sensorielle.',
    durationMin: 120, groupMin: 1, groupMax: 2, capacity: 1, capacityUnit: 'groupes', price: 95, priceUnit: 'session',
    discount: 25, color: '#1E7F57', offer: 'Privatisation 2 h', times: [['10:00', 30], ['14:00', 25]],
  },
  {
    slug: 'hache-et-cie', name: 'Hache & Cie', category: 'hache', city: 'Charleroi', area: 'Ville-Basse',
    address: 'Boulevard Tirou 70, 6000 Charleroi',
    description: 'Quatre pistes de lancer de haches encadrées par un coach, avec cibles interactives.',
    durationMin: 60, groupMin: 2, groupMax: 8, capacity: 4, capacityUnit: 'groupes', price: 25, priceUnit: 'person',
    discount: 30, color: '#8C3B2A', offer: 'Session 1 h', times: [['14:00', 30], ['16:00', 30], ['18:30', 25]],
  },
  {
    slug: 'cle-de-voute', name: 'Clé de Voûte', category: 'escape', city: 'Mons', area: 'Centre-ville',
    address: 'Rue de Nimy 48, 7000 Mons',
    description: 'Deux salles de 60 minutes autour des légendes montoises, de 2 à 6 joueurs.',
    durationMin: 60, groupMin: 2, groupMax: 6, capacity: 2, capacityUnit: 'groupes', price: 25, priceUnit: 'person',
    discount: 25, color: '#5B2A86', status: 'submitted', offer: 'Salle 60 min', times: [],
  },
  {
    slug: 'laser-spot', name: 'Laser Spot', category: 'laser', city: 'Frameries', area: 'Centre',
    address: 'Rue de France 15, 7080 Frameries',
    description: 'Laser game familial de 400 m², parties de 20 minutes, dès 7 ans.',
    durationMin: 20, groupMin: 4, groupMax: 16, capacity: 16, capacityUnit: 'places', price: 12, priceUnit: 'person',
    discount: 30, color: '#1F6F8B', status: 'submitted', offer: 'Partie 20 min', times: [],
  },
];

async function main() {
  const url = process.env.DATABASE_URL ?? 'postgres://aubaine:aubaine@localhost:5432/aubaine';
  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });

  await sql.begin(async (tx) => {
    await tx`delete from bookings where venue_id in (select id from venues where is_demo)`;
    await tx`delete from venues where is_demo`;

    const [partner] = await tx`
      insert into users (email, first_name, kind) values ('demo.exploitant@aubaine.test', 'Sophie', 'exploitant')
      on conflict (email) do update set first_name = excluded.first_name, kind = 'exploitant' returning id`;

    for (const d of DEMOS) {
      const status = d.status ?? 'published';
      const [v] = await tx`
        insert into venues (slug, name, category, city, area, address, description, duration_min, group_min, group_max,
          capacity, capacity_unit, price_cents, price_unit, base_discount_pct, color, status, is_demo,
          submitted_at, published_at)
        values (${d.slug}, ${d.name}, ${d.category}, ${d.city}, ${d.area}, ${d.address}, ${d.description},
          ${d.durationMin}, ${d.groupMin}, ${d.groupMax}, ${d.capacity}, ${d.capacityUnit}, ${d.price * 100},
          ${d.priceUnit}, ${d.discount}, ${d.color}, ${status}, true,
          now() - interval '3 hours', ${status === 'published' ? sql`now() - interval '30 days'` : null})
        returning id`;

      if (d.slug === 'kartohm') {
        await tx`insert into venue_members (venue_id, user_id, role) values (${v.id}, ${partner.id}, 'owner')`;
      }

      const all: Extra[] = [{ ...d, name: d.offer, description: undefined }, ...(d.more ?? [])];
      for (const [pos, o] of all.entries()) {
        const [offer] = await tx`
          insert into offers (venue_id, name, description, duration_min, group_min, group_max, capacity, capacity_unit, price_cents, price_unit, position)
          values (${v.id}, ${o.name}, ${o.description ?? null}, ${o.durationMin}, ${o.groupMin}, ${o.groupMax}, ${o.capacity}, ${o.capacityUnit}, ${o.price * 100}, ${o.priceUnit}, ${pos})
          returning id`;
        // Créneaux creux du lundi au vendredi, sur les 30 prochains jours (heure de Bruxelles).
        for (const [time, pct] of o.times) {
          await tx`
            insert into slots (venue_id, offer_id, starts_at, capacity, discount_pct)
            select ${v.id}, ${offer.id}, (day::date + ${time}::time) at time zone 'Europe/Brussels', ${o.capacity}, ${pct}
            from generate_series((now() at time zone 'Europe/Brussels')::date,
                                 (now() at time zone 'Europe/Brussels')::date + 29, interval '1 day') as day
            where extract(isodow from day) <= 5`;
        }
      }
    }
  });

  const [{ n }] = await sql`select count(*)::int as n from slots`;
  const [{ o }] = await sql`select count(*)::int as o from offers`;
  console.log(`Démo prête : ${DEMOS.length} établissements, ${o} prestations, ${n} créneaux.`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
