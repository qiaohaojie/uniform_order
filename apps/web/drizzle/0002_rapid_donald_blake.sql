ALTER TABLE "tenants" ADD COLUMN "platform_approval_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "platform_approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "platform_approved_by" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "platform_rejection_reason" text;