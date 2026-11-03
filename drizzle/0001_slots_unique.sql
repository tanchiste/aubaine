DROP INDEX "slots_venue_start_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "slots_venue_start_uniq" ON "slots" USING btree ("venue_id","starts_at");