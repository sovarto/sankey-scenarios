ALTER TABLE "connections" ADD COLUMN "displayOrder" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_groups" ADD COLUMN "displayOrder" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_nodes" ADD COLUMN "displayOrder" integer DEFAULT 0 NOT NULL;