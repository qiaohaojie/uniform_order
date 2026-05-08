ALTER TABLE "order_refunds" ALTER COLUMN "operator_user_id" SET DATA TYPE uuid USING NULLIF("operator_user_id", '')::uuid;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "parent_children" ALTER COLUMN "parent_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_operator_user_id_user_id_fk" FOREIGN KEY ("operator_user_id") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;
