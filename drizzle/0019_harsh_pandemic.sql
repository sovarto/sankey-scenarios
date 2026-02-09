ALTER TABLE "connections" ADD COLUMN "valueExpression" varchar(500);--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "valueDescription" text;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "valueExpression" varchar(500);--> statement-breakpoint
ALTER TABLE "scenario_groups" ADD COLUMN "valueExpression" varchar(500);--> statement-breakpoint
ALTER TABLE "scenario_groups" ADD COLUMN "valueDescription" text;