CREATE TABLE "pkce_store" (
	"state" varchar PRIMARY KEY NOT NULL,
	"code_verifier" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
