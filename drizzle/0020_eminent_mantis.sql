ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "oidcSubject" varchar(255);