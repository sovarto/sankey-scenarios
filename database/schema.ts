import { relations } from 'drizzle-orm';
import { integer, pgTable, real, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core';

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
    localNodes: many(scenarioLocalNodes),
    connections: many(connections),
    groupReferences: many(scenarioGroups),
    nodeReferences: many(scenarioNodes)
}));

// Local nodes within a scenario - these are named nodes that exist only in this scenario
// Editing the name here updates it everywhere it's used in the scenario
export const scenarioLocalNodes = pgTable('scenario_local_nodes', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    scenarioId: integer().notNull().references(() => scenarios.id, { onDelete: 'cascade' }),
    name: varchar({ length: 255 }).notNull()
}, table => [ unique().on(table.scenarioId, table.name) ]);

export const scenarioLocalNodesRelations = relations(scenarioLocalNodes, ({ one, many }) => ({
    scenario: one(scenarios, {
        fields: [ scenarioLocalNodes.scenarioId ],
        references: [ scenarios.id ]
    }),
    connectionsAsSource: many(connections, { relationName: 'sourceLocalNode' }),
    connectionsAsTarget: many(connections, { relationName: 'targetLocalNode' }),
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
// For scenario connections: sourceLocalNodeId and targetLocalNodeId reference local nodes
// For group connections: source and target are plain strings (group templates)
// placeholderType: null = regular connection, 'missing' = placeholder for Missing flow, 'remaining' = placeholder for Remaining flow
// autoValue: if true, value is calculated as total incoming to the source node (only one auto connection per source allowed)
export const connections = pgTable('connections', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    scenarioId: integer().references(() => scenarios.id, { onDelete: 'cascade' }),
    groupId: integer().references(() => groups.id, { onDelete: 'cascade' }),
    // For scenario connections - reference local nodes
    sourceLocalNodeId: integer().references(() => scenarioLocalNodes.id, { onDelete: 'cascade' }),
    targetLocalNodeId: integer().references(() => scenarioLocalNodes.id, { onDelete: 'cascade' }),
    // For group connections - plain strings (templates)
    source: varchar({ length: 255 }),
    target: varchar({ length: 255 }),
    value: real().notNull(),
    // Placeholder type for auto-balancing: 'missing' (source provides Missing), 'remaining' (target receives Remaining)
    placeholderType: varchar({ length: 20 }),
    // Auto value: if true, value is calculated as total incoming to the source node
    autoValue: integer().notNull().default(0), // 0 = false, 1 = true
    displayOrder: integer().notNull().default(0),
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
    }),
    sourceLocalNode: one(scenarioLocalNodes, {
        fields: [ connections.sourceLocalNodeId ],
        references: [ scenarioLocalNodes.id ],
        relationName: 'sourceLocalNode'
    }),
    targetLocalNode: one(scenarioLocalNodes, {
        fields: [ connections.targetLocalNodeId ],
        references: [ scenarioLocalNodes.id ],
        relationName: 'targetLocalNode'
    })
}));

// Junction table: links scenarios to groups they use
// The connectingLocalNodeId references which local node the group connects TO or FROM
// direction: "source" means localNode → [group nodes] (group defines targets)
// direction: "target" means [group nodes] → localNode (group defines sources)
export const scenarioGroups = pgTable('scenario_groups', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    scenarioId: integer().notNull().references(() => scenarios.id, { onDelete: 'cascade' }),
    groupId: integer().notNull().references(() => groups.id, { onDelete: 'cascade' }),
    connectingLocalNodeId: integer().notNull().references(() => scenarioLocalNodes.id, { onDelete: 'cascade' }),
    direction: varchar({ length: 10 }).notNull().default('source'), // 'source' or 'target'
    showGroupNode: integer().notNull().default(0), // 0 = false, 1 = true (show group name as intermediate node)
    displayOrder: integer().notNull().default(0)
});

export const scenarioGroupsRelations = relations(scenarioGroups, ({ one }) => ({
    scenario: one(scenarios, {
        fields: [ scenarioGroups.scenarioId ],
        references: [ scenarios.id ]
    }),
    group: one(groups, {
        fields: [ scenarioGroups.groupId ],
        references: [ groups.id ]
    }),
    connectingLocalNode: one(scenarioLocalNodes, {
        fields: [ scenarioGroups.connectingLocalNodeId ],
        references: [ scenarioLocalNodes.id ]
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
// connectingLocalNodeId references which local node this connects TO or FROM
// direction: "source" means this node is the source (node → localNode)
// direction: "target" means this node is the target (localNode → node)
export const scenarioNodes = pgTable('scenario_nodes', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    scenarioId: integer().notNull().references(() => scenarios.id, { onDelete: 'cascade' }),
    nodeId: integer().notNull().references(() => nodes.id, { onDelete: 'cascade' }),
    connectingLocalNodeId: integer().notNull().references(() => scenarioLocalNodes.id, { onDelete: 'cascade' }),
    direction: varchar({ length: 10 }).notNull().default('target'), // 'source' or 'target'
    displayOrder: integer().notNull().default(0)
});

export const scenarioNodesRelations = relations(scenarioNodes, ({ one }) => ({
    scenario: one(scenarios, {
        fields: [ scenarioNodes.scenarioId ],
        references: [ scenarios.id ]
    }),
    node: one(nodes, {
        fields: [ scenarioNodes.nodeId ],
        references: [ nodes.id ]
    }),
    connectingLocalNode: one(scenarioLocalNodes, {
        fields: [ scenarioNodes.connectingLocalNodeId ],
        references: [ scenarioLocalNodes.id ]
    })
}));
