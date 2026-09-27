ALTER TYPE "public"."document_type" ADD VALUE 'credit_note';--> statement-breakpoint
ALTER TYPE "public"."document_type" ADD VALUE 'debit_note';--> statement-breakpoint
ALTER TABLE "business_profiles" ADD COLUMN "credit_note_prefix" text DEFAULT 'CN-' NOT NULL;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD COLUMN "credit_note_counter" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD COLUMN "debit_note_prefix" text DEFAULT 'DN-' NOT NULL;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD COLUMN "debit_note_counter" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "adjustment_total" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "related_document_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_related_document_id_documents_id_fk" FOREIGN KEY ("related_document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;