-- New enums
CREATE TYPE "order_fulfilment_status" AS ENUM ('to_prepare','ready','needs_attention','completed');
CREATE TYPE "order_payment_status"    AS ENUM ('pending','paid','partially_refunded','refunded');
CREATE TYPE "order_completion_type"   AS ENUM ('collected','shipped','manual');
CREATE TYPE "order_fulfilment_method" AS ENUM ('pickup','shipping');
CREATE TYPE "workflow_mode"           AS ENUM ('standard','simple');
CREATE TYPE "notification_type"       AS ENUM ('ready','hold','refund');
CREATE TYPE "notification_status"     AS ENUM ('queued','sent','failed','skipped');
CREATE TYPE "order_event_type" AS ENUM (
  'order_paid','pick_slip_printed','status_changed','ready_email_sent',
  'hold_email_sent','refund_email_sent','refund_created','refund_failed','order_reopened'
);

-- tenant_settings
CREATE TABLE "tenant_settings" (
  "tenant_id"        text PRIMARY KEY REFERENCES "tenants"("id") ON DELETE CASCADE,
  "workflow_mode"    "workflow_mode"  NOT NULL DEFAULT 'standard',
  "pickup_enabled"   boolean          NOT NULL DEFAULT true,
  "shipping_enabled" boolean          NOT NULL DEFAULT false,
  "created_at"       timestamptz      NOT NULL DEFAULT now(),
  "updated_at"       timestamptz      NOT NULL DEFAULT now(),
  "updated_by"       uuid REFERENCES "neon_auth"."user"("id") ON DELETE SET NULL
);

CREATE TABLE "tenant_setting_events" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"   text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "setting_key" text NOT NULL,
  "old_value"   text,
  "new_value"   text NOT NULL,
  "changed_by"  uuid REFERENCES "neon_auth"."user"("id") ON DELETE SET NULL,
  "reason"      text,
  "created_at"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "idx_tenant_setting_events_tenant_time"
  ON "tenant_setting_events"("tenant_id","created_at");

-- order_events
CREATE TABLE "order_events" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id"      text NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "tenant_id"     text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "event_type"    "order_event_type" NOT NULL,
  "from_status"   "order_fulfilment_status",
  "to_status"     "order_fulfilment_status",
  "actor_id"      uuid REFERENCES "neon_auth"."user"("id") ON DELETE SET NULL,
  "reason"        text,
  "metadata_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at"    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "idx_order_events_order_time"  ON "order_events"("order_id","created_at");
CREATE INDEX "idx_order_events_tenant_time" ON "order_events"("tenant_id","created_at");

-- order_notification_events
CREATE TABLE "order_notification_events" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id"              text NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "tenant_id"             text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "type"                  "notification_type"   NOT NULL,
  "status"                "notification_status" NOT NULL DEFAULT 'queued',
  "recipient_email"       text NOT NULL,
  "provider_message_id"   text,
  "failure_reason"        text,
  "metadata_json"         jsonb NOT NULL DEFAULT '{}'::jsonb,
  "idempotency_key"       text,
  "triggered_by"          text,
  "triggered_by_user_id"  uuid REFERENCES "neon_auth"."user"("id") ON DELETE SET NULL,
  "created_at"            timestamptz NOT NULL DEFAULT now(),
  "sent_at"               timestamptz,
  "failed_at"             timestamptz
);
CREATE UNIQUE INDEX "uniq_order_notification_idempotency"
  ON "order_notification_events"("idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
CREATE INDEX "idx_order_notification_order_type_time"
  ON "order_notification_events"("order_id","type","created_at");

-- Add new orders columns (nullable so backfill can fill them before NOT NULL)
ALTER TABLE "orders"
  ADD COLUMN "fulfilment_status" "order_fulfilment_status",
  ADD COLUMN "payment_status"    "order_payment_status",
  ADD COLUMN "completion_type"   "order_completion_type",
  ADD COLUMN "fulfilment_method" "order_fulfilment_method",
  ADD COLUMN "refunded_amount_cents" integer NOT NULL DEFAULT 0,
  ADD COLUMN "ready_at"          timestamptz,
  ADD COLUMN "completed_at"      timestamptz,
  ADD COLUMN "pick_slip_printed_at" timestamptz,
  ADD COLUMN "pick_slip_printed_by" uuid REFERENCES "neon_auth"."user"("id") ON DELETE SET NULL;

-- Backfill orders
UPDATE "orders" SET
  "fulfilment_method" = CASE WHEN "delivery" = 'ship' THEN 'shipping'::order_fulfilment_method
                              ELSE 'pickup'::order_fulfilment_method END,
  "fulfilment_status" = CASE "status"
                          WHEN 'pending_payment' THEN 'to_prepare'
                          WHEN 'new'             THEN 'to_prepare'
                          WHEN 'packing'         THEN 'to_prepare'
                          WHEN 'ready'           THEN 'ready'
                          WHEN 'collected'       THEN 'completed'
                          WHEN 'partially_refunded' THEN 'completed'
                          WHEN 'refunded'        THEN 'completed'
                        END::order_fulfilment_status,
  "payment_status"    = CASE "status"
                          WHEN 'pending_payment' THEN 'pending'
                          WHEN 'partially_refunded' THEN 'partially_refunded'
                          WHEN 'refunded'        THEN 'refunded'
                          ELSE 'paid'
                        END::order_payment_status,
  "completion_type"   = CASE "status"
                          WHEN 'collected'          THEN 'collected'::order_completion_type
                          WHEN 'partially_refunded' THEN 'collected'::order_completion_type
                          WHEN 'refunded'           THEN 'collected'::order_completion_type
                          ELSE NULL
                        END,
  "ready_at"          = CASE WHEN "status" = 'ready'     THEN "updated_at" ELSE NULL END,
  "completed_at"      = CASE WHEN "status" IN ('collected','partially_refunded','refunded')
                              THEN "updated_at" ELSE NULL END;

-- Backfill refunded amount (cents)
UPDATE "orders" o SET "refunded_amount_cents" = COALESCE(sub.cents, 0)
FROM (
  SELECT "order_id", ROUND(SUM("amount") * 100)::int AS cents
  FROM "order_refunds" GROUP BY "order_id"
) sub
WHERE o.id = sub.order_id;

-- Enforce NOT NULL
ALTER TABLE "orders"
  ALTER COLUMN "fulfilment_status" SET NOT NULL,
  ALTER COLUMN "payment_status"    SET NOT NULL,
  ALTER COLUMN "fulfilment_method" SET NOT NULL,
  ALTER COLUMN "fulfilment_status" SET DEFAULT 'to_prepare',
  ALTER COLUMN "payment_status"    SET DEFAULT 'pending',
  ALTER COLUMN "fulfilment_method" SET DEFAULT 'pickup';

CREATE INDEX "idx_orders_tenant_fulfilment_status"
  ON "orders"("tenant_id","fulfilment_status");

-- Drop legacy columns + enums
ALTER TABLE "orders" DROP COLUMN "status";
ALTER TABLE "orders" DROP COLUMN "delivery";
DROP TYPE "order_status";
DROP TYPE "delivery_method";

-- Seed tenant_settings for every existing tenant
INSERT INTO "tenant_settings" ("tenant_id")
SELECT "id" FROM "tenants"
ON CONFLICT ("tenant_id") DO NOTHING;
