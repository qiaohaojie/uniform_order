CREATE TYPE "public"."policy_mode" AS ENUM('text', 'url');--> statement-breakpoint
CREATE TABLE "tenant_legal_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"version" integer NOT NULL,
	"policy_mode" "policy_mode" NOT NULL,
	"policy_text" text,
	"policy_url" text,
	"acl_acknowledged" boolean NOT NULL,
	"seller_of_record_acknowledged" boolean NOT NULL,
	"declarant_name" text NOT NULL,
	"declarant_role" text NOT NULL,
	"entered_by_user_id" uuid NOT NULL,
	"entered_by_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "legal_version_id" uuid;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "current_legal_version_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_legal_versions_tenant_version_unique" ON "tenant_legal_versions" USING btree ("tenant_id","version");--> statement-breakpoint
-- FKs (Drizzle column doesn't model these; enforced at DB layer)
ALTER TABLE "tenant_legal_versions"
  ADD CONSTRAINT "tenant_legal_versions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;--> statement-breakpoint

ALTER TABLE "tenant_legal_versions"
  ADD CONSTRAINT "tenant_legal_versions_entered_by_user_id_fkey"
  FOREIGN KEY ("entered_by_user_id") REFERENCES "neon_auth"."user"("id");--> statement-breakpoint

ALTER TABLE "tenants"
  ADD CONSTRAINT "tenants_current_legal_version_id_fkey"
  FOREIGN KEY ("current_legal_version_id") REFERENCES "tenant_legal_versions"("id");--> statement-breakpoint

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_legal_version_id_fkey"
  FOREIGN KEY ("legal_version_id") REFERENCES "tenant_legal_versions"("id");--> statement-breakpoint

-- Check constraint enforcing text-XOR-url
ALTER TABLE "tenant_legal_versions"
  ADD CONSTRAINT "tenant_legal_versions_mode_check"
  CHECK (
    ("policy_mode" = 'text' AND "policy_text" IS NOT NULL AND "policy_url" IS NULL)
    OR
    ("policy_mode" = 'url'  AND "policy_url"  IS NOT NULL AND "policy_text" IS NULL)
  );