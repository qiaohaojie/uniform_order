ALTER TYPE "public"."preloved_intake_source" ADD VALUE IF NOT EXISTS 'consignment';--> statement-breakpoint
ALTER TABLE "preloved_intake_events" ADD COLUMN IF NOT EXISTS "consignment_lot_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "preloved_intake_events"
    ADD CONSTRAINT "preloved_intake_events_consignment_lot_id_consignment_lots_id_fk"
    FOREIGN KEY ("consignment_lot_id") REFERENCES "consignment_lots"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_preloved_intake_events_lot_time"
  ON "preloved_intake_events" ("consignment_lot_id", "created_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consignment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"lot_id" uuid NOT NULL REFERENCES "consignment_lots"("id") ON DELETE cascade,
	"preloved_sku_id" uuid NOT NULL REFERENCES "preloved_skus"("id") ON DELETE restrict,
	"intake_event_id" uuid NOT NULL REFERENCES "preloved_intake_events"("id") ON DELETE restrict,
	"source_item_id" text NOT NULL REFERENCES "catalog_items"("id") ON DELETE restrict,
	"size" text NOT NULL,
	"condition" "preloved_condition" NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"sold_order_line_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consignment_items_qty_positive" CHECK ("qty" >= 1)
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "consignment_items_intake_event_unique"
  ON "consignment_items" ("intake_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_consignment_items_lot_time"
  ON "consignment_items" ("lot_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_consignment_items_sku_time"
  ON "consignment_items" ("preloved_sku_id", "created_at");
