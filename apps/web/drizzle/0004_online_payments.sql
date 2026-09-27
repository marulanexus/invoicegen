CREATE TYPE "public"."checkout_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."gateway_provider" AS ENUM('payfast', 'yoco');--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'payfast';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'yoco';--> statement-breakpoint
CREATE TABLE "payment_checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"gateway_id" uuid,
	"provider" "gateway_provider" NOT NULL,
	"mode" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text NOT NULL,
	"status" "checkout_status" DEFAULT 'pending' NOT NULL,
	"provider_reference" text,
	"provider_payment_id" text,
	"payment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payment_gateways" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" "gateway_provider" NOT NULL,
	"mode" text DEFAULT 'test' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"merchant_id" text,
	"secrets_enc" text NOT NULL,
	"webhook_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_checkouts" ADD CONSTRAINT "payment_checkouts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_checkouts" ADD CONSTRAINT "payment_checkouts_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_checkouts" ADD CONSTRAINT "payment_checkouts_gateway_id_payment_gateways_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."payment_gateways"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_checkouts" ADD CONSTRAINT "payment_checkouts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_gateways" ADD CONSTRAINT "payment_gateways_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_checkouts_document_idx" ON "payment_checkouts" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "payment_checkouts_provider_ref_idx" ON "payment_checkouts" USING btree ("provider","provider_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_gateways_org_provider_idx" ON "payment_gateways" USING btree ("org_id","provider");