CREATE TYPE "public"."consignment_payout_preference" AS ENUM('eft', 'school_fee_credit', 'donate_proceeds');--> statement-breakpoint
CREATE TYPE "public"."consignment_unsold_preference" AS ENUM('donate', 'collect');--> statement-breakpoint
CREATE TYPE "public"."consignment_lot_payout_status" AS ENUM('pending', 'school_fee_credited', 'eft_paid', 'donated_proceeds');--> statement-breakpoint
CREATE TABLE "consignment_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"ticket_code" text NOT NULL,
	"family_name" text NOT NULL,
	"student_name" text NOT NULL,
	"email" text NOT NULL,
	"mobile" text NOT NULL,
	"payout_preference" "consignment_payout_preference" NOT NULL,
	"bank_bsb" text,
	"bank_account_name" text,
	"bank_account_number" text,
	"unsold_preference" "consignment_unsold_preference" NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"terms_accepted_at" timestamp with time zone NOT NULL,
	"payout_status" "consignment_lot_payout_status" DEFAULT 'pending' NOT NULL,
	"payout_marked_at" timestamp with time zone,
	"payout_marked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "consignment_lots_tenant_ticket_unique" ON "consignment_lots" USING btree ("tenant_id","ticket_code");--> statement-breakpoint
CREATE INDEX "idx_consignment_lots_tenant_time" ON "consignment_lots" USING btree ("tenant_id","created_at");
