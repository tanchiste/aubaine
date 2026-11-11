ALTER TABLE "bookings" ADD COLUMN "stripe_account_id" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "stripe_account_id" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "stripe_charges_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "stripe_payouts_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "stripe_bancontact" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "stripe_details_submitted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "stripe_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_stripe_account_id_unique" UNIQUE("stripe_account_id");