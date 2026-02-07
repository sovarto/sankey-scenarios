/**
 * Loader for scenario view page
 */

import { eq, and } from 'drizzle-orm';
import { buildResolvedConnections, addBalancingFlows, getExistingPlaceholders } from './resolvedConnections';
import { database } from '~/database/context';
import * as schema from '~/database/schema';

export async function loadScenarioView(projectId: number, scenarioId: number) {
    const db = database();

    const project = await db.query.projects.findFirst({
        where: eq(schema.projects.id, projectId),
        columns: { id: true, name: true }
    });

    if (!project) {
        throw new Response('Project not found', { status: 404 });
    }

    const scenario = await db.query.scenarios.findFirst({
        where: and(
            eq(schema.scenarios.id, scenarioId),
            eq(schema.scenarios.projectId, projectId)
        ),
        with: {
            localNodes: true,
            connections: {
                with: {
                    sourceLocalNode: true,
                    targetLocalNode: true
                },
                orderBy: (connections, { asc }) => [ asc(connections.displayOrder) ]
            },
            groupReferences: {
                with: {
                    group: {
                        with: {
                            connections: true
                        }
                    },
                    connectingLocalNode: true
                },
                orderBy: (groupReferences, { asc }) => [ asc(groupReferences.displayOrder) ]
            },
            nodeReferences: {
                with: {
                    node: true,
                    connectingLocalNode: true
                },
                orderBy: (nodeReferences, { asc }) => [ asc(nodeReferences.displayOrder) ]
            }
        }
    });

    if (!scenario) {
        throw new Response('Scenario not found', { status: 404 });
    }

    // Get all available groups for this project
    const groups = await db.query.groups.findMany({
        where: eq(schema.groups.projectId, projectId),
        columns: { id: true, name: true },
        orderBy: (groups, { asc }) => [ asc(groups.name) ]
    });

    // Get all available nodes for this project
    const nodes = await db.query.nodes.findMany({
        where: eq(schema.nodes.projectId, projectId),
        columns: { id: true, name: true, value: true },
        orderBy: (nodes, { asc }) => [ asc(nodes.name) ]
    });

    const resolvedConnections = addBalancingFlows(buildResolvedConnections(scenario));
    const existingPlaceholders = getExistingPlaceholders(scenario);

    return { project, scenario, resolvedConnections, groups, nodes, existingPlaceholders };
}
