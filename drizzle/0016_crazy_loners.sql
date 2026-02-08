CREATE TABLE IF NOT EXISTS "scenario_group_node_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "scenario_group_node_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"scenarioGroupId" integer NOT NULL,
	"nodeName" varchar(255) NOT NULL,
	"displayOrder" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "scenario_group_node_orders_scenarioGroupId_nodeName_unique" UNIQUE("scenarioGroupId","nodeName")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scenario_group_node_orders" ADD CONSTRAINT "scenario_group_node_orders_scenarioGroupId_scenario_groups_id_fk" FOREIGN KEY ("scenarioGroupId") REFERENCES "public"."scenario_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
