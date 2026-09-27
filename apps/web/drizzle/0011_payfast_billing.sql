CREATE TYPE "public"."billing_interval" AS ENUM('monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."billing_provider" AS ENUM('stripe', 'payfast');--> statement-breakpoint
CREATE TABLE "billing_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" "billing_provider" NOT NULL,
	"provider_payment_id" text NOT NULL,
	"plan" "plan" NOT NULL,
	"billing_interval" "billing_interval" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"vat_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vat_number" text,
	"period_end" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_payments_provider_payment_id_unique" UNIQUE("provider_payment_id")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "provider" "billing_provider";--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "billing_interval" "billing_interval";--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "payfast_token" text;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;