CREATE TYPE "preloved_intake_mode" AS ENUM ('donation_only', 'donation_and_consignment');
--> statement-breakpoint
CREATE TYPE "preloved_condition" AS ENUM ('good', 'fair');
--> statement-breakpoint
CREATE TYPE "preloved_intake_source" AS ENUM ('donation');
--> statement-breakpoint
CREATE TYPE "preloved_intake_action" AS ENUM ('accepted', 'rejected', 'written_off');
--> statement-breakpoint
CREATE TABLE "tenant_preloved_settings" (
	"tenant_id" text PRIMARY KEY NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"preloved_enabled" boolean DEFAULT false NOT NULL,
	"intake_mode" "preloved_intake_mode" DEFAULT 'donation_only' NOT NULL,
	"price_fraction_of_new" numeric(4, 2) DEFAULT 0.50 NOT NULL,
	"hold_days" integer DEFAULT 365 NOT NULL,
	"donated_gst_free" boolean DEFAULT false NOT NULL,
	"refuse_list" jsonb DEFAULT '["socks","swimwear","hats"]'::jsonb NOT NULL,
	"commission_bps" integer DEFAULT 5000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preloved_skus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"source_item_id" text NOT NULL REFERENCES "catalog_items"("id") ON DELETE restrict,
	"size" text NOT NULL,
	"condition" "preloved_condition" NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"qty_on_hand" integer DEFAULT 0 NOT NULL,
	"gst_free" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"image_url" text,
	"listed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "preloved_skus_qty_on_hand_non_negative" CHECK ("qty_on_hand" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "preloved_skus_tenant_item_size_condition_unique"
	ON "preloved_skus" ("tenant_id", "source_item_id", "size", "condition");
--> statement-breakpoint
CREATE INDEX "idx_preloved_skus_tenant_expires_at"
	ON "preloved_skus" ("tenant_id", "expires_at");
--> statement-breakpoint
CREATE TABLE "preloved_intake_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"preloved_sku_id" uuid,
	"source_item_id" text,
	"size" text,
	"condition" "preloved_condition",
	"source" "preloved_intake_source" DEFAULT 'donation' NOT NULL,
	"action" "preloved_intake_action" NOT NULL,
	"qty" integer NOT NULL,
	"reject_reason" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "preloved_intake_events"
	ADD CONSTRAINT "preloved_intake_events_preloved_sku_id_preloved_skus_id_fk"
	FOREIGN KEY ("preloved_sku_id") REFERENCES "preloved_skus"("id")
	ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "preloved_intake_events"
	ADD CONSTRAINT "preloved_intake_events_source_item_id_catalog_items_id_fk"
	FOREIGN KEY ("source_item_id") REFERENCES "catalog_items"("id")
	ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "preloved_intake_events"
	ADD CONSTRAINT "preloved_intake_events_actor_id_user_id_fk"
	FOREIGN KEY ("actor_id") REFERENCES "neon_auth"."user"("id")
	ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_preloved_intake_events_tenant_time"
	ON "preloved_intake_events" ("tenant_id", "created_at");
--> statement-breakpoint
CREATE INDEX "idx_preloved_intake_events_sku_time"
	ON "preloved_intake_events" ("preloved_sku_id", "created_at");
--> statement-breakpoint
ALTER TABLE "order_lines"
	ADD COLUMN "preloved_sku_id" uuid,
	ADD COLUMN "gst_free" boolean DEFAULT false NOT NULL,
	ADD COLUMN "condition" "preloved_condition";
--> statement-breakpoint
ALTER TABLE "order_lines"
	ADD CONSTRAINT "order_lines_preloved_sku_id_preloved_skus_id_fk"
	FOREIGN KEY ("preloved_sku_id") REFERENCES "preloved_skus"("id")
	ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "tenant_preloved_settings" (
	"tenant_id",
	"preloved_enabled",
	"intake_mode",
	"price_fraction_of_new",
	"hold_days",
	"donated_gst_free",
	"refuse_list",
	"commission_bps"
)
SELECT
	"id",
	false,
	'donation_only'::"preloved_intake_mode",
	0.50,
	365,
	false,
	'["socks","swimwear","hats"]'::jsonb,
	5000
FROM "tenants"
ON CONFLICT ("tenant_id") DO NOTHING;
