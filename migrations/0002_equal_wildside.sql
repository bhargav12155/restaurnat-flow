CREATE TABLE "brand_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"assets" jsonb,
	"colors" jsonb,
	"fonts" jsonb,
	"description" text,
	"social_connections" jsonb,
	"logo_info" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "brand_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "avatars" ADD COLUMN "supports_gestures" boolean DEFAULT false;