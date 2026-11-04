CREATE TYPE "public"."account_kind" AS ENUM('client', 'exploitant');--> statement-breakpoint
ALTER TABLE "login_codes" ADD COLUMN "payload" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kind" "account_kind" DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "city" text;--> statement-breakpoint
UPDATE "users" SET "kind" = 'exploitant' WHERE "id" IN (SELECT "user_id" FROM "venue_members");
