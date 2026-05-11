CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tenant_id" text,
	"actor_email" text NOT NULL,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "audit_events_actor_role_check"
		CHECK ("actor_role" IN ('operator', 'platform_admin')),
	CONSTRAINT "audit_events_target_type_check"
		CHECK ("target_type" IN ('order', 'tenant', 'catalog_item', 'tenant_legal_version'))
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_tenants_id_fk"
	FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
	ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE INDEX "idx_audit_events_tenant_time" ON "audit_events" ("tenant_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "idx_audit_events_target" ON "audit_events" ("target_type", "target_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "idx_audit_events_actor_time" ON "audit_events" ("actor_email", "created_at" DESC);
