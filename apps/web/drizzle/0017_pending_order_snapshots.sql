CREATE TABLE IF NOT EXISTS "pending_order_snapshots" (
	"payment_intent_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"user_id" uuid,
	"fulfilment_method" "order_fulfilment_method" NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"gst" numeric(10, 2) NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"lines_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_order_snapshots"
	ADD CONSTRAINT "pending_order_snapshots_user_id_user_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id")
	ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pending_order_snapshots_created_at"
	ON "pending_order_snapshots" ("created_at");
