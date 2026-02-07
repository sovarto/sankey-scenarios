-- Step 1: Create the new local nodes table
CREATE TABLE IF NOT EXISTS "scenario_local_nodes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "scenario_local_nodes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"scenarioId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	CONSTRAINT "scenario_local_nodes_scenarioId_name_unique" UNIQUE("scenarioId","name")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scenario_local_nodes" ADD CONSTRAINT "scenario_local_nodes_scenarioId_scenarios_id_fk" FOREIGN KEY ("scenarioId") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Step 2: Populate local nodes from existing data
-- From connections (source and target)
INSERT INTO "scenario_local_nodes" ("scenarioId", "name")
SELECT DISTINCT "scenarioId", "source" FROM "connections" WHERE "scenarioId" IS NOT NULL AND "source" IS NOT NULL
ON CONFLICT ("scenarioId", "name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "scenario_local_nodes" ("scenarioId", "name")
SELECT DISTINCT "scenarioId", "target" FROM "connections" WHERE "scenarioId" IS NOT NULL AND "target" IS NOT NULL
ON CONFLICT ("scenarioId", "name") DO NOTHING;
--> statement-breakpoint
-- From scenario_groups (connectingNode)
INSERT INTO "scenario_local_nodes" ("scenarioId", "name")
SELECT DISTINCT "scenarioId", "connectingNode" FROM "scenario_groups" WHERE "connectingNode" IS NOT NULL
ON CONFLICT ("scenarioId", "name") DO NOTHING;
--> statement-breakpoint
-- From scenario_nodes (connectingNode)
INSERT INTO "scenario_local_nodes" ("scenarioId", "name")
SELECT DISTINCT "scenarioId", "connectingNode" FROM "scenario_nodes" WHERE "connectingNode" IS NOT NULL
ON CONFLICT ("scenarioId", "name") DO NOTHING;
--> statement-breakpoint

-- Step 3: Add new columns as nullable first
ALTER TABLE "connections" ADD COLUMN "sourceLocalNodeId" integer;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "targetLocalNodeId" integer;--> statement-breakpoint
ALTER TABLE "scenario_groups" ADD COLUMN "connectingLocalNodeId" integer;--> statement-breakpoint
ALTER TABLE "scenario_nodes" ADD COLUMN "connectingLocalNodeId" integer;
--> statement-breakpoint

-- Step 4: Populate the new columns from existing data
UPDATE "connections" c
SET "sourceLocalNodeId" = sln.id
FROM "scenario_local_nodes" sln
WHERE c."scenarioId" = sln."scenarioId" AND c."source" = sln."name" AND c."scenarioId" IS NOT NULL;
--> statement-breakpoint
UPDATE "connections" c
SET "targetLocalNodeId" = sln.id
FROM "scenario_local_nodes" sln
WHERE c."scenarioId" = sln."scenarioId" AND c."target" = sln."name" AND c."scenarioId" IS NOT NULL;
--> statement-breakpoint
UPDATE "scenario_groups" sg
SET "connectingLocalNodeId" = sln.id
FROM "scenario_local_nodes" sln
WHERE sg."scenarioId" = sln."scenarioId" AND sg."connectingNode" = sln."name";
--> statement-breakpoint
UPDATE "scenario_nodes" sn
SET "connectingLocalNodeId" = sln.id
FROM "scenario_local_nodes" sln
WHERE sn."scenarioId" = sln."scenarioId" AND sn."connectingNode" = sln."name";
--> statement-breakpoint

-- Step 5: Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "connections" ADD CONSTRAINT "connections_sourceLocalNodeId_scenario_local_nodes_id_fk" FOREIGN KEY ("sourceLocalNodeId") REFERENCES "public"."scenario_local_nodes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "connections" ADD CONSTRAINT "connections_targetLocalNodeId_scenario_local_nodes_id_fk" FOREIGN KEY ("targetLocalNodeId") REFERENCES "public"."scenario_local_nodes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scenario_groups" ADD CONSTRAINT "scenario_groups_connectingLocalNodeId_scenario_local_nodes_id_fk" FOREIGN KEY ("connectingLocalNodeId") REFERENCES "public"."scenario_local_nodes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scenario_nodes" ADD CONSTRAINT "scenario_nodes_connectingLocalNodeId_scenario_local_nodes_id_fk" FOREIGN KEY ("connectingLocalNodeId") REFERENCES "public"."scenario_local_nodes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Step 6: Make the new columns NOT NULL (for scenario_groups and scenario_nodes)
ALTER TABLE "scenario_groups" ALTER COLUMN "connectingLocalNodeId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_nodes" ALTER COLUMN "connectingLocalNodeId" SET NOT NULL;
--> statement-breakpoint

-- Step 7: Make source/target nullable (they're only used for group connections now)
ALTER TABLE "connections" ALTER COLUMN "source" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "connections" ALTER COLUMN "target" DROP NOT NULL;
--> statement-breakpoint

-- Step 8: Drop old columns
ALTER TABLE "scenario_groups" DROP COLUMN IF EXISTS "connectingNode";--> statement-breakpoint
ALTER TABLE "scenario_nodes" DROP COLUMN IF EXISTS "connectingNode";