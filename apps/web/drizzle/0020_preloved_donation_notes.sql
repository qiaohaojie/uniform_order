CREATE TABLE "preloved_donation_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"parent_name" text NOT NULL,
	"student_name" text NOT NULL,
	"bag_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preloved_donation_notes_bag_count_range" CHECK ("bag_count" >= 1 AND "bag_count" <= 20)
);
