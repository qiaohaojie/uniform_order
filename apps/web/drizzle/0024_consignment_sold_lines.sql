DO $$ BEGIN
  ALTER TABLE "consignment_items"
    ADD CONSTRAINT "consignment_items_sold_order_line_id_order_lines_id_fk"
    FOREIGN KEY ("sold_order_line_id") REFERENCES "order_lines"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_consignment_items_sold_line"
  ON "consignment_items" ("sold_order_line_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consignment_sold_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"lot_id" uuid NOT NULL REFERENCES "consignment_lots"("id") ON DELETE cascade,
	"consignment_item_id" uuid NOT NULL REFERENCES "consignment_items"("id") ON DELETE restrict,
	"order_id" text NOT NULL REFERENCES "orders"("id") ON DELETE restrict,
	"order_line_id" uuid NOT NULL REFERENCES "order_lines"("id") ON DELETE restrict,
	"preloved_sku_id" uuid NOT NULL REFERENCES "preloved_skus"("id") ON DELETE restrict,
	"qty" integer DEFAULT 1 NOT NULL,
	"sale_unit_price" numeric(10, 2) NOT NULL,
	"sale_line_total" numeric(10, 2) NOT NULL,
	"commission_bps" integer NOT NULL,
	"commission_amount" numeric(10, 2) NOT NULL,
	"remittance_amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consignment_sold_lines_qty_positive" CHECK ("qty" >= 1)
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "consignment_sold_lines_item_unique"
  ON "consignment_sold_lines" ("consignment_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_consignment_sold_lines_tenant_time"
  ON "consignment_sold_lines" ("tenant_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_consignment_sold_lines_lot_time"
  ON "consignment_sold_lines" ("lot_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_consignment_sold_lines_order"
  ON "consignment_sold_lines" ("order_id");
