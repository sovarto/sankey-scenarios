import { relations } from 'drizzle-orm';
import { integer, pgTable, real, text, timestamp, varchar } from 'drizzle-orm/pg-core';

// Projects - top level container for scenarios
export const projects = pgTable('projects', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull()
});

export const projectsRelations = relations(projects, ({ many }) => ({
    scenarios: many(scenarios),
    groups: many(groups),
    nodes: many(nodes)
}));

// Scenarios - each scenario is a diagram belonging to a project
export const scenarios = pgTable('scenarios', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    projectId: integer().notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull()
});

export const scenariosRelations = relations(scenarios, ({ one, many }) => ({
    project: one(projects, {
        fields: [ scenarios.projectId ],
        references: [ projects.id ]
    }),
    connections: many(connections),
    groupReferences: many(scenarioGroups),
    nodeReferences: many(scenarioNodes)
}));

// Groups - reusable connection templates within a project
export const groups = pgTable('groups', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    projectId: integer().notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull()
});

export const groupsRelations = relations(groups, ({ one, many }) => ({
    project: one(projects, {
        fields: [ groups.projectId ],
        references: [ projects.id ]
    }),
    connections: many(connections),
    scenarioReferences: many(scenarioGroups)
}));

// Connections - can belong to either a scenario OR a group (not both)
// source -> target with a value
export const connections = pgTable('connections', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    scenarioId: integer().references(() => scenarios.id, { onDelete: 'cascade' }),
    groupId: integer().references(() => groups.id, { onDelete: 'cascade' }),
    source: varchar({ length: 255 }).notNull(),
    target: varchar({ length: 255 }).notNull(),
    value: real().notNull(),
    createdAt: timestamp().defaultNow().notNull()
});

export const connectionsRelations = relations(connections, ({ one }) => ({
    scenario: one(scenarios, {
        fields: [ connections.scenarioId ],
        references: [ scenarios.id ]
    }),
    group: one(groups, {
        fields: [ connections.groupId ],
        references: [ groups.id ]
    })
}));

// Junction table: links scenarios to groups they use
// The connectingNode is what the group connects TO or FROM in this scenario
// direction: "source" means connectingNode → [group nodes] (group defines targets)
// direction: "target" means [group nodes] → connectingNode (group defines sources)
export const scenarioGroups = pgTable('scenario_groups', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    scenarioId: integer().notNull().references(() => scenarios.id, { onDelete: 'cascade' }),
    groupId: integer().notNull().references(() => groups.id, { onDelete: 'cascade' }),
    connectingNode: varchar({ length: 255 }).notNull(),
    direction: varchar({ length: 10 }).notNull().default('source') // 'source' or 'target'
});

export const scenarioGroupsRelations = relations(scenarioGroups, ({ one }) => ({
    scenario: one(scenarios, {
        fields: [ scenarioGroups.scenarioId ],
        references: [ scenarios.id ]
    }),
    group: one(groups, {
        fields: [ scenarioGroups.groupId ],
        references: [ groups.id ]
    })
}));

// Nodes - reusable single nodes with a name and value within a project
export const nodes = pgTable('nodes', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    projectId: integer().notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar({ length: 255 }).notNull(),
    value: real().notNull(),
    description: text(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull()
});

export const nodesRelations = relations(nodes, ({ one, many }) => ({
    project: one(projects, {
        fields: [ nodes.projectId ],
        references: [ projects.id ]
    }),
    scenarioReferences: many(scenarioNodes)
}));

// Junction table: links scenarios to nodes they use
// connectingNode is what this node connects TO or FROM
// direction: "source" means this node is the source (node → connectingNode)
// direction: "target" means this node is the target (connectingNode → node)
export const scenarioNodes = pgTable('scenario_nodes', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    scenarioId: integer().notNull().references(() => scenarios.id, { onDelete: 'cascade' }),
    nodeId: integer().notNull().references(() => nodes.id, { onDelete: 'cascade' }),
    connectingNode: varchar({ length: 255 }).notNull(),
    direction: varchar({ length: 10 }).notNull().default('target') // 'source' or 'target'
});

export const scenarioNodesRelations = relations(scenarioNodes, ({ one }) => ({
    scenario: one(scenarios, {
        fields: [ scenarioNodes.scenarioId ],
        references: [ scenarios.id ]
    }),
    node: one(nodes, {
        fields: [ scenarioNodes.nodeId ],
        references: [ nodes.id ]
    })
}));
