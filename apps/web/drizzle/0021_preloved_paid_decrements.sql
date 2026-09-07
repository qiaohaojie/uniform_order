CREATE TABLE IF NOT EXISTS "preloved_paid_decrements" (
	"payment_intent_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
