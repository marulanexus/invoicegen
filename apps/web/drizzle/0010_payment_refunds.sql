CREATE TYPE "public"."payment_kind" AS ENUM('payment', 'refund');--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "kind" "payment_kind" DEFAULT 'payment' NOT NULL;