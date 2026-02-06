-- First add connectingNode as nullable and copy data from sourceNode
ALTER TABLE "scenario_groups" ADD COLUMN "connectingNode" varchar(255);--> statement-breakpoint
UPDATE "scenario_groups" SET "connectingNode" = "sourceNode" WHERE "sourceNode" IS NOT NULL;--> statement-breakpoint
UPDATE "scenario_groups" SET "connectingNode" = '' WHERE "connectingNode" IS NULL;--> statement-breakpoint
ALTER TABLE "scenario_groups" ALTER COLUMN "connectingNode" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_groups" ADD COLUMN "direction" varchar(10) DEFAULT 'source' NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_groups" DROP COLUMN IF EXISTS "sourceNode";