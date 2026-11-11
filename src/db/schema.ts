import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true });

/* ---------- Énumérations ---------- */

export const venueCategory = pgEnum('venue_category', [
  'escape',
  'karting',
  'laser',
  'vr',
  'bowling',
  'hache',
  'bienetre',
  'autre',
]);

/** draft → submitted → (changes_requested ↺) → published | rejected ; published ↔ paused */
export const venueStatus = pgEnum('venue_status', [
  'draft',
  'submitted',
  'changes_requested',
  'published',
  'rejected',
  'paused',
]);

/** person : prix par personne ; session : prix pour la séance entière (spa privatif, salle…) */
export const priceUnit = pgEnum('price_unit', ['person', 'session']);

/** places : chaque personne prend une place ; groupes : chaque réservation prend une salle/piste entière */
export const capacityUnit = pgEnum('capacity_unit', ['places', 'groupes']);

/** owner : gérant (tout) ; staff : accueil (valide les arrivées uniquement) */
export const memberRole = pgEnum('member_role', ['owner', 'staff']);

/** client : cherche des activités ; exploitant : gère un établissement (ou en fait partie) */
export const accountKind = pgEnum('account_kind', ['client', 'exploitant']);

/** pending : places tenues pendant le paiement en ligne (jusqu'à expires_at) */
export const bookingStatus = pgEnum('booking_status', ['pending', 'confirmed', 'checked_in', 'cancelled', 'no_show']);

/* ---------- Comptes ---------- */

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  kind: accountKind('kind').notNull().default('client'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  phone: text('phone'),
  /** ville préférée, utilisée par défaut dans Explorer */
  city: text('city'),
  referralCode: text('referral_code').unique(),
  /** Conditions acceptées (version = date de la version en vigueur, voir src/lib/legal.ts) */
  termsAcceptedAt: ts('terms_accepted_at'),
  termsVersion: text('terms_version'),
  /** Conditions partenaires acceptées par un exploitant */
  partnerTermsAcceptedAt: ts('partner_terms_accepted_at'),
  partnerTermsVersion: text('partner_terms_version'),
  /** Compte supprimé à la demande : données personnelles effacées, réservations gardées pour la comptabilité */
  deletedAt: ts('deleted_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const loginCodes = pgTable(
  'login_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    codeHash: text('code_hash').notNull(),
    /** données d'inscription en attente de vérification du code */
    payload: jsonb('payload'),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: ts('expires_at').notNull(),
    usedAt: ts('used_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('login_codes_email_idx').on(t.email, t.createdAt)],
);

export const sessions = pgTable(
  'sessions',
  {
    /** empreinte SHA-256 du jeton du cookie : le jeton lui-même n'est jamais stocké */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: ts('expires_at').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/* ---------- Établissements ---------- */

export const venues = pgTable(
  'venues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    category: venueCategory('category').notNull(),
    city: text('city').notNull().default('Mons'),
    area: text('area'),
    address: text('address'),
    /** Position sur la carte (géocodée depuis l'adresse) */
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    description: text('description'),
    durationMin: integer('duration_min').notNull().default(60),
    groupMin: integer('group_min').notNull().default(1),
    groupMax: integer('group_max').notNull().default(6),
    capacity: integer('capacity').notNull().default(1),
    capacityUnit: capacityUnit('capacity_unit').notNull().default('groupes'),
    priceCents: integer('price_cents').notNull().default(0),
    priceUnit: priceUnit('price_unit').notNull().default('person'),
    baseDiscountPct: integer('base_discount_pct').notNull().default(25),
    color: text('color').notNull().default('#3A28D4'),
    status: venueStatus('status').notNull().default('draft'),
    reviewMessage: text('review_message'),
    submittedAt: ts('submitted_at'),
    publishedAt: ts('published_at'),
    /** Exploitant légal de l'établissement (affiché aux clients : obligation des places de marché) */
    legalName: text('legal_name'),
    /** Numéro d'entreprise BCE, au format 0123.456.789 */
    companyNumber: text('company_number'),
    /** données de démonstration, à supprimer avant le lancement */
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [index('venues_status_idx').on(t.status)],
);

export const venuePhotos = pgTable(
  'venue_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    mime: text('mime').notNull(),
    width: integer('width'),
    height: integer('height'),
    data: bytea('data').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('venue_photos_venue_idx').on(t.venueId, t.position)],
);

export const venueMembers = pgTable(
  'venue_members',
  {
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRole('role').notNull().default('owner'),
    /** Email à chaque réservation ou annulation, et récap de la veille */
    notify: boolean('notify').notNull().default(true),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.venueId, t.userId] }), index('venue_members_user_idx').on(t.userId)],
);

/** Historique de la validation : qui a fait quoi sur la fiche, avec le message envoyé */
export const venueEvents = pgTable(
  'venue_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    message: text('message'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('venue_events_venue_idx').on(t.venueId, t.createdAt)],
);

/**
 * Prestations : ce que l'établissement vend (session de 15 min, Grand Prix, salle « La Prison »…).
 * Chaque prestation a sa durée, son prix, sa taille de groupe et sa capacité ; les créneaux s'y rattachent.
 */
export const offers = pgTable(
  'offers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    durationMin: integer('duration_min').notNull().default(60),
    groupMin: integer('group_min').notNull().default(1),
    groupMax: integer('group_max').notNull().default(6),
    capacity: integer('capacity').notNull().default(1),
    capacityUnit: capacityUnit('capacity_unit').notNull().default('groupes'),
    priceCents: integer('price_cents').notNull().default(0),
    priceUnit: priceUnit('price_unit').notNull().default('person'),
    isActive: boolean('is_active').notNull().default(true),
    position: integer('position').notNull().default(0),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('offers_venue_idx').on(t.venueId, t.position)],
);

/* ---------- Créneaux et réservations ---------- */

export const slots = pgTable(
  'slots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'cascade' }),
    offerId: uuid('offer_id')
      .notNull()
      .references(() => offers.id, { onDelete: 'cascade' }),
    startsAt: ts('starts_at').notNull(),
    /** dans l'unité de l'établissement (places ou groupes) */
    capacity: integer('capacity').notNull(),
    discountPct: integer('discount_pct').notNull(),
    isOpen: boolean('is_open').notNull().default(true),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('slots_offer_start_uniq').on(t.offerId, t.startsAt),
    index('slots_venue_start_idx').on(t.venueId, t.startsAt),
    index('slots_start_idx').on(t.startsAt),
  ],
);

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    slotId: uuid('slot_id')
      .notNull()
      .references(() => slots.id, { onDelete: 'restrict' }),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    people: integer('people').notNull(),
    /** prix plein total, remise et total payé, figés au moment de la réservation */
    fullCents: integer('full_cents').notNull(),
    discountPct: integer('discount_pct').notNull(),
    totalCents: integer('total_cents').notNull(),
    status: bookingStatus('status').notNull().default('confirmed'),
    checkedInAt: ts('checked_in_at'),
    cancelledAt: ts('cancelled_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
    /** Paiement : fin de la tenue des places, moyen utilisé (bancontact, card, simulé), références Stripe */
    expiresAt: ts('expires_at'),
    paymentMethod: text('payment_method'),
    stripeSessionId: text('stripe_session_id').unique(),
    stripePaymentIntent: text('stripe_payment_intent'),
    paidAt: ts('paid_at'),
    refundedAt: ts('refunded_at'),
    /** commission Aubaine figée au paiement */
    feeCents: integer('fee_cents').notNull().default(0),
    /** Annulation : par le client, par l'établissement (avec le motif envoyé au client) */
    cancelledBy: text('cancelled_by'),
    cancelReason: text('cancel_reason'),
    /** Rappel envoyé la veille */
    remindedAt: ts('reminded_at'),
  },
  (t) => [
    index('bookings_slot_idx').on(t.slotId),
    index('bookings_user_idx').on(t.userId),
    index('bookings_venue_idx').on(t.venueId, t.createdAt),
  ],
);

/* ---------- Signalements (règlement sur les services numériques) ---------- */

export const reportStatus = pgEnum('report_status', ['open', 'resolved', 'dismissed']);

/** Contenu signalé par un visiteur : fiche, photo, prix trompeur… traité par l'équipe Aubaine */
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    venueId: uuid('venue_id').references(() => venues.id, { onDelete: 'cascade' }),
    reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'set null' }),
    email: text('email'),
    reason: text('reason').notNull(),
    details: text('details').notNull(),
    status: reportStatus('status').notNull().default('open'),
    /** Décision et motivation, envoyées à la personne qui a signalé */
    resolution: text('resolution'),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: ts('resolved_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('reports_status_idx').on(t.status, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type AccountKind = (typeof accountKind.enumValues)[number];
export type MemberRole = (typeof memberRole.enumValues)[number];
export type Venue = typeof venues.$inferSelect;
export type Slot = typeof slots.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type VenueStatus = (typeof venueStatus.enumValues)[number];
export type VenueCategory = (typeof venueCategory.enumValues)[number];
export type Report = typeof reports.$inferSelect;
