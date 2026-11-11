CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"month" text NOT NULL,
	"bookings_count" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"fee_cents" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"holder" text,
	"iban" text NOT NULL,
	"reference" text,
	"paid_by" uuid,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payout_id" uuid;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "payout_holder" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "payout_iban" text;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_venue_month_uniq" ON "payouts" USING btree ("venue_id","month");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE set null ON UPDATE no action;