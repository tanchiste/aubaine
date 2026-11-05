CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_min" integer DEFAULT 60 NOT NULL,
	"group_min" integer DEFAULT 1 NOT NULL,
	"group_max" integer DEFAULT 6 NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"capacity_unit" "capacity_unit" DEFAULT 'groupes' NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"price_unit" "price_unit" DEFAULT 'person' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "slots_venue_start_uniq";--> statement-breakpoint
ALTER TABLE "slots" ADD COLUMN "offer_id" uuid;--> statement-breakpoint
INSERT INTO "offers" ("venue_id", "name", "duration_min", "group_min", "group_max", "capacity", "capacity_unit", "price_cents", "price_unit")
  SELECT "id", 'Séance de ' || "duration_min" || ' min', "duration_min", "group_min", "group_max", "capacity", "capacity_unit", "price_cents", "price_unit" FROM "venues";--> statement-breakpoint
UPDATE "slots" s SET "offer_id" = o."id" FROM "offers" o WHERE o."venue_id" = s."venue_id";--> statement-breakpoint
ALTER TABLE "slots" ALTER COLUMN "offer_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "offers_venue_idx" ON "offers" USING btree ("venue_id","position");--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "slots_offer_start_uniq" ON "slots" USING btree ("offer_id","starts_at");--> statement-breakpoint
CREATE INDEX "slots_venue_start_idx" ON "slots" USING btree ("venue_id","starts_at");