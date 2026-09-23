ALTER TABLE "business_profiles" ADD COLUMN "default_template_key" text DEFAULT 'classic' NOT NULL;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD COLUMN "default_footer" text;