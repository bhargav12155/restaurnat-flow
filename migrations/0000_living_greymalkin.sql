CREATE TABLE "ai_content" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"content_type" varchar NOT NULL,
	"title" varchar,
	"content" text NOT NULL,
	"keywords" jsonb,
	"property_id" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"metric_type" text NOT NULL,
	"metric_value" numeric,
	"dimension" text,
	"timestamp" timestamp DEFAULT now(),
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "avatars" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"heygen_avatar_id" text NOT NULL,
	"avatar_type" text NOT NULL,
	"gender" text,
	"preview_image_url" text,
	"preview_video_url" text,
	"is_public" boolean DEFAULT false,
	"supports_gestures" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "avatars_heygen_avatar_id_unique" UNIQUE("heygen_avatar_id")
);
--> statement-breakpoint
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
CREATE TABLE "company_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"business_name" text NOT NULL,
	"agent_name" text NOT NULL,
	"agent_title" text,
	"phone" text,
	"email" text,
	"office_address" text,
	"license_number" text,
	"brokerage_name" text,
	"tagline" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "company_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "content_opportunities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"neighborhood" text,
	"keyword_id" text,
	"trend_source" text NOT NULL,
	"search_signal" integer DEFAULT 50,
	"metadata" jsonb,
	"generated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content_pieces" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"keywords" text[],
	"neighborhood" text,
	"seo_optimized" boolean DEFAULT false,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"scheduled_for" timestamp,
	"social_platforms" text[],
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "custom_voices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"heygen_voice_id" text NOT NULL,
	"language" text NOT NULL,
	"gender" text,
	"sample_audio_url" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "custom_voices_heygen_voice_id_unique" UNIQUE("heygen_voice_id")
);
--> statement-breakpoint
CREATE TABLE "engagement_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_user_id" integer,
	"session_id" text,
	"agent_id" varchar,
	"agent_slug" text NOT NULL,
	"engagement_score" integer DEFAULT 0,
	"engagement_reason" text NOT NULL,
	"engagement_details" jsonb,
	"most_viewed_property_id" text,
	"most_time_spent_property_id" text,
	"liked_property_ids" jsonb,
	"detected_email" text,
	"detected_phone" text,
	"detected_name" text,
	"lead_quality" text DEFAULT 'warm',
	"lead_status" text DEFAULT 'auto_generated',
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"converted_to_contact_at" timestamp,
	"contacted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "file_uploads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"filename" varchar NOT NULL,
	"original_name" varchar NOT NULL,
	"mime_type" varchar NOT NULL,
	"size" integer NOT NULL,
	"path" varchar NOT NULL,
	"url" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "market_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"neighborhood" text NOT NULL,
	"avg_price" integer,
	"days_on_market" integer,
	"inventory" text,
	"price_growth" text,
	"trend" text,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"source" text NOT NULL,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"duration_seconds" integer,
	"avatar_id" varchar,
	"title" text,
	"description" text,
	"mime_type" text,
	"file_size" integer,
	"width" integer,
	"height" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "photo_avatar_group_voices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"group_id" text NOT NULL,
	"audio_url" text NOT NULL,
	"heygen_audio_asset_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "photo_avatar_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"heygen_group_id" text NOT NULL,
	"name" text NOT NULL,
	"image_hash" text,
	"s3_image_url" text,
	"heygen_image_key" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"training_progress" integer DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "photo_avatar_groups_heygen_group_id_unique" UNIQUE("heygen_group_id")
);
--> statement-breakpoint
CREATE TABLE "photo_avatars" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"photo_url" text NOT NULL,
	"heygen_photo_id" text,
	"pose_type" text NOT NULL,
	"processing_status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pkce_store" (
	"state" varchar PRIMARY KEY NOT NULL,
	"code_verifier" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "post_media" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar NOT NULL,
	"media_id" varchar NOT NULL,
	"order_index" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mls_id" text NOT NULL,
	"list_price" integer NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"zip_code" text NOT NULL,
	"bedrooms" integer,
	"bathrooms" real,
	"square_footage" integer,
	"lot_size" real,
	"year_built" integer,
	"property_type" text NOT NULL,
	"listing_status" text NOT NULL,
	"listing_date" timestamp NOT NULL,
	"description" text,
	"features" text[],
	"photo_urls" text[],
	"virtual_tour_url" text,
	"latitude" real,
	"longitude" real,
	"neighborhood" text,
	"school_district" text,
	"agent_id" text,
	"agent_name" text,
	"office_id" text,
	"office_name" text,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_user_id" integer,
	"property_id" text,
	"agent_slug" text NOT NULL,
	"interaction_type" text NOT NULL,
	"interaction_value" text,
	"time_spent_seconds" integer DEFAULT 0,
	"ip_address" text,
	"user_agent" text,
	"session_id" text,
	"referrer_url" text,
	"current_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "property_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_user_id" integer,
	"property_id" text NOT NULL,
	"agent_slug" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"session_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "public_users" (
	"id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "public_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"name" text,
	"agent_slug" text NOT NULL,
	"preferences" jsonb,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "public_users_agent_slug_email_unique" UNIQUE("agent_slug","email")
);
--> statement-breakpoint
CREATE TABLE "scheduled_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"platform" text NOT NULL,
	"post_type" text,
	"content" text NOT NULL,
	"hashtags" text[],
	"scheduled_for" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"is_edited" boolean DEFAULT false,
	"original_content" text,
	"neighborhood" text,
	"seo_score" integer DEFAULT 0,
	"is_ai_generated" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "seo_keywords" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"keyword" text NOT NULL,
	"current_rank" integer,
	"previous_rank" integer,
	"search_volume" integer,
	"difficulty" integer,
	"neighborhood" text,
	"last_checked" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"facebook_app_id" text,
	"facebook_app_secret" text,
	"instagram_business_account_id" text,
	"instagram_token" text,
	"twitter_api_key" text,
	"twitter_api_secret" text,
	"twitter_access_token" text,
	"twitter_access_token_secret" text,
	"linkedin_client_id" text,
	"linkedin_client_secret" text,
	"linkedin_access_token" text,
	"youtube_api_key" text,
	"youtube_channel_id" text,
	"tiktok_access_token" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_media_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"platform" text NOT NULL,
	"account_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"is_connected" boolean DEFAULT false,
	"last_sync" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"platforms" jsonb,
	"scheduled_at" timestamp,
	"published_at" timestamp,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"engagement" jsonb,
	"ai_content_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tutorial_videos" (
	"id" integer PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "tutorial_videos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"category" text NOT NULL,
	"subcategory" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"video_url" text NOT NULL,
	"thumbnail_url" text,
	"duration" integer,
	"order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_activity" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"public_user_id" integer,
	"agent_slug" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"device_type" text,
	"browser_name" text,
	"operating_system" text,
	"country" text,
	"city" text,
	"first_page_visited" text,
	"last_page_visited" text,
	"total_time_spent_seconds" integer DEFAULT 0,
	"total_page_views" integer DEFAULT 0,
	"total_properties_viewed" integer DEFAULT 0,
	"total_properties_liked" integer DEFAULT 0,
	"conversion_type" text,
	"conversion_value" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_sessions_session_id_key" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'agent' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "video_content" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"avatar_id" varchar,
	"title" text NOT NULL,
	"script" text NOT NULL,
	"topic" text,
	"neighborhood" text,
	"video_type" text,
	"platform" text,
	"duration" integer,
	"thumbnail_url" text,
	"video_url" text,
	"youtube_url" text,
	"youtube_video_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"tags" text[],
	"seo_optimized" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"heygen_video_id" text,
	"heygen_avatar_id" text,
	"heygen_voice_id" text,
	"heygen_template_id" text
);
--> statement-breakpoint
ALTER TABLE "engagement_leads" ADD CONSTRAINT "engagement_leads_public_user_id_public_users_id_fk" FOREIGN KEY ("public_user_id") REFERENCES "public"."public_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_leads" ADD CONSTRAINT "engagement_leads_session_id_user_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."user_sessions"("session_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_leads" ADD CONSTRAINT "engagement_leads_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_interactions" ADD CONSTRAINT "property_interactions_public_user_id_public_users_id_fk" FOREIGN KEY ("public_user_id") REFERENCES "public"."public_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_likes" ADD CONSTRAINT "property_likes_public_user_id_public_users_id_fk" FOREIGN KEY ("public_user_id") REFERENCES "public"."public_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_public_user_id_public_users_id_fk" FOREIGN KEY ("public_user_id") REFERENCES "public"."public_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");