ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "refund_policy_accepted_at" timestamp;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_stripe_payment_intent_id_unique" ON "orders" USING btree ("stripe_payment_intent_id");