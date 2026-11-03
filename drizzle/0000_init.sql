CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'checked_in', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."capacity_unit" AS ENUM('places', 'groupes');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'staff');--> statement-breakpoint
CREATE TYPE "public"."price_unit" AS ENUM('person', 'session');--> statement-breakpoint
CREATE TYPE "public"."venue_category" AS ENUM('escape', 'karting', 'laser', 'vr', 'bowling', 'hache', 'bienetre', 'autre');--> statement-breakpoint
CREATE TYPE "public"."venue_status" AS ENUM('draft', 'submitted', 'changes_requested', 'published', 'rejected', 'paused');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"slot_id" uuid NOT NULL,
	"venue_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"people" integer NOT NULL,
	"full_cents" integer NOT NULL,
	"discount_pct" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"checked_in_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "login_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"capacity" integer NOT NULL,
	"discount_pct" integer NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"referral_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "venue_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_members" (
	"venue_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_members_venue_id_user_id_pk" PRIMARY KEY("venue_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "venue_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"mime" text NOT NULL,
	"width" integer,
	"height" integer,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" "venue_category" NOT NULL,
	"city" text DEFAULT 'Mons' NOT NULL,
	"area" text,
	"address" text,
	"description" text,
	"duration_min" integer DEFAULT 60 NOT NULL,
	"group_min" integer DEFAULT 1 NOT NULL,
	"group_max" integer DEFAULT 6 NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"capacity_unit" "capacity_unit" DEFAULT 'groupes' NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"price_unit" "price_unit" DEFAULT 'person' NOT NULL,
	"base_discount_pct" integer DEFAULT 25 NOT NULL,
	"color" text DEFAULT '#3A28D4' NOT NULL,
	"status" "venue_status" DEFAULT 'draft' NOT NULL,
	"review_message" text,
	"submitted_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venues_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_events" ADD CONSTRAINT "venue_events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_events" ADD CONSTRAINT "venue_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_members" ADD CONSTRAINT "venue_members_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_members" ADD CONSTRAINT "venue_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_photos" ADD CONSTRAINT "venue_photos_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_slot_idx" ON "bookings" USING btree ("slot_id");--> statement-breakpoint
CREATE INDEX "bookings_user_idx" ON "bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookings_venue_idx" ON "bookings" USING btree ("venue_id","created_at");--> statement-breakpoint
CREATE INDEX "login_codes_email_idx" ON "login_codes" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "slots_venue_start_idx" ON "slots" USING btree ("venue_id","starts_at");--> statement-breakpoint
CREATE INDEX "slots_start_idx" ON "slots" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "venue_events_venue_idx" ON "venue_events" USING btree ("venue_id","created_at");--> statement-breakpoint
CREATE INDEX "venue_members_user_idx" ON "venue_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "venue_photos_venue_idx" ON "venue_photos" USING btree ("venue_id","position");--> statement-breakpoint
CREATE INDEX "venues_status_idx" ON "venues" USING btree ("status");