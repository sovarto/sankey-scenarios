ALTER TABLE "scenario_groups" ADD COLUMN "value" real;--> statement-breakpoint
ALTER TABLE "scenario_groups" ADD COLUMN "autoValue" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_groups" ADD COLUMN "placeholderType" varchar(20);