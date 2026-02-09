import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, real, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core';

// ============================================
// Users and Roles
// ============================================

// Users table
export const users = pgTable('users', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    email: varchar({ length: 255 }).notNull().unique(),
    passwordHash: varchar({ length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    // Status: 'pending' (awaiting admin approval), 'active', 'blocked'
    status: varchar({ length: 20 }).notNull().default('pending'),
    // Locale preferences (BCP 47 language tags, e.g., 'en-US', 'de-DE')
    displayLocale: varchar({ length: 35 }), // For UI language
    regionalLocale: varchar({ length: 35 }), // For number/date formatting
    // For password reset
    resetToken: varchar({ length: 255 }),
    resetTokenExpiresAt: timestamp(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull()
});

export const usersRelations = relations(users, ({ many }) => ({
    userRoles: many(userRoles),
    projectShares: many(projectShares)
}));

// Roles table
export const roles = pgTable('roles', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 50 }).notNull().unique(), // 'admin' or 'member'
    description: text()
});

export const rolesRelations = relations(roles, ({ many }) => ({
    userRoles: many(userRoles)
}));

// Junction table: users can have multiple roles
export const userRoles = pgTable('user_roles', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer().notNull().references(() => users.id, { onDelete: 'cascade' }),
    roleId: integer().notNull().references(() => roles.id, { onDelete: 'cascade' })
}, table => [ unique().on(table.userId, table.roleId) ]);

export const userRolesRelations = relations(userRoles, ({ one }) => ({
    user: one(users, {
        fields: [ userRoles.userId ],
        references: [ users.id ]
    }),
    role: one(roles, {
        fields: [ userRoles.roleId ],
        references: [ roles.id ]
    })
}));

// Sessions table for managing user sessions
export const sessions = pgTable('sessions', {
    id: varchar({ length: 255 }).primaryKey(),
    userId: integer().notNull().references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp().notNull(),
    createdAt: timestamp().defaultNow().notNull()
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, {
        fields: [ sessions.userId ],
        references: [ users.id ]
    })
}));

// ============================================
// Projects and Scenarios
// ============================================

// Projects - top level container for scenarios, owned by a user
export const projects = pgTable('projects', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer().notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull()
});

export const projectsRelations = relations(projects, ({ one, many }) => ({
    user: one(users, {
        fields: [ projects.userId ],
        references: [ users.id ]
    }),
    scenarios: many(scenarios),
    groups: many(groups),
    nodes: many(nodes),
    shares: many(projectShares)
}));

// Project shares - allows sharing projects with other users
export const projectShares = pgTable('project_shares', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    projectId: integer().notNull().references(() => projects.id, { onDelete: 'cascade' }),
    userId: integer().notNull().references(() => users.id, { onDelete: 'cascade' }),
    // Permission level: 'readonly' or 'readwrite'
    permission: varchar({ length: 20 }).notNull().default('readonly'),
    createdAt: timestamp().defaultNow().notNull()
}, table => [ unique().on(table.projectId, table.userId) ]);

export const projectSharesRelations = relations(projectShares, ({ one }) => ({
    project: one(projects, {
        fields: [ projectShares.projectId ],
        references: [ projects.id ]
    }),
    user: one(users, {
        fields: [ projectShares.userId ],
        references: [ users.id ]
    })
}));

// Scenarios - each scenario is a diagram belonging to a project
export const scenarios = pgTable('scenarios', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    projectId: integer().notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    autoFitLabels: boolean().default(false).notNull(),
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
// valueType: 'absolute' (default) = value is a fixed number, 'percent' = value is a percentage of total incoming to source node
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
    // Expression used to calculate the value (e.g., "100 + 50", "1000 * 0.5")
    valueExpression: varchar({ length: 500 }),
    // Optional description/documentation for the value
    valueDescription: text(),
    // Value type: 'absolute' (default) = fixed number, 'percent' = percentage of total incoming to source node
    valueType: varchar({ length: 20 }).notNull().default('absolute'),
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
// subNode: optional - if set, only connect to this specific node within the group
// When subNode is set, value/autoValue/placeholderType/valueType work like direct connections
export const scenarioGroups = pgTable('scenario_groups', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    scenarioId: integer().notNull().references(() => scenarios.id, { onDelete: 'cascade' }),
    groupId: integer().notNull().references(() => groups.id, { onDelete: 'cascade' }),
    connectingLocalNodeId: integer().notNull().references(() => scenarioLocalNodes.id, { onDelete: 'cascade' }),
    direction: varchar({ length: 10 }).notNull().default('source'), // 'source' or 'target'
    showGroupNode: integer().notNull().default(0), // 0 = false, 1 = true (show group name as intermediate node)
    subNode: varchar({ length: 255 }), // null = connect to all, otherwise specific node name within the group
    // When subNode is set, these work like direct connections:
    value: real(), // custom value - if null, uses sum of group connections for that subNode
    // Expression used to calculate the value (e.g., "100 + 50", "1000 * 0.5")
    valueExpression: varchar({ length: 500 }),
    // Optional description/documentation for the value
    valueDescription: text(),
    // Value type: 'absolute' (default) = fixed number, 'percent' = percentage of total incoming to source node
    valueType: varchar({ length: 20 }).notNull().default('absolute'),
    autoValue: integer().notNull().default(0), // 0 = false, 1 = true (calculate as total incoming)
    placeholderType: varchar({ length: 20 }), // 'remaining' - value will be calculated
    displayOrder: integer().notNull().default(0)
});

export const scenarioGroupsRelations = relations(scenarioGroups, ({ one, many }) => ({
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
    }),
    nodeOrders: many(scenarioGroupNodeOrders)
}));

// Nodes - reusable single nodes with a name and value within a project
export const nodes = pgTable('nodes', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    projectId: integer().notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar({ length: 255 }).notNull(),
    value: real().notNull(),
    // Expression used to calculate the value (e.g., "100 + 50", "1000 * 0.5")
    valueExpression: varchar({ length: 500 }),
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

// Per-scenario order overrides for nodes within a group reference
// This allows reordering group nodes specifically for one scenario without affecting the group definition
export const scenarioGroupNodeOrders = pgTable('scenario_group_node_orders', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    scenarioGroupId: integer().notNull().references(() => scenarioGroups.id, { onDelete: 'cascade' }),
    nodeName: varchar({ length: 255 }).notNull(), // The node name within the group
    displayOrder: integer().notNull().default(0)
}, table => [ unique().on(table.scenarioGroupId, table.nodeName) ]);

export const scenarioGroupNodeOrdersRelations = relations(scenarioGroupNodeOrders, ({ one }) => ({
    scenarioGroup: one(scenarioGroups, {
        fields: [ scenarioGroupNodeOrders.scenarioGroupId ],
        references: [ scenarioGroups.id ]
    })
}));
