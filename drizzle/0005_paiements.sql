ALTER TYPE "public"."booking_status" ADD VALUE 'pending' BEFORE 'confirmed';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "stripe_session_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "stripe_payment_intent" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "fee_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_stripe_session_id_unique" UNIQUE("stripe_session_id");--> statement-breakpoint
UPDATE "bookings" SET "payment_method" = 'simulé', "fee_cents" = round("total_cents" * 0.15) WHERE "payment_method" IS NULL;
