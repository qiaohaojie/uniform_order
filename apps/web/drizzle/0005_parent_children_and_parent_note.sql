CREATE TABLE "parent_children" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"year" text NOT NULL,
	"roll_class" text,
	"last_confirmed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "parent_note" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "is_publicly_listed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "parent_children" ADD CONSTRAINT "parent_children_parent_id_user_id_fk" FOREIGN KEY ("parent_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_children" ADD CONSTRAINT "parent_children_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "parent_children_parent_idx" ON "parent_children" USING btree ("parent_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;

-- Seed v1 launch tenants as publicly listed.
UPDATE "tenants" SET "is_publicly_listed" = true WHERE "id" IN ('nsbh', 'rgsh');