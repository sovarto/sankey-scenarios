/**
 * Server-side helper functions for scenario view operations
 */

import { eq, and } from 'drizzle-orm';
import type { database } from '~/database/context';
import * as schema from '~/database/schema';

type Database = ReturnType<typeof database>;

/**
 * Get an existing local node by name, or create a new one if it doesn't exist
 */
export async function getOrCreateLocalNode(db: Database, scenarioId: number, name: string): Promise<number> {
    const existing = await db.query.scenarioLocalNodes.findFirst({
        where: and(
            eq(schema.scenarioLocalNodes.scenarioId, scenarioId),
            eq(schema.scenarioLocalNodes.name, name.trim())
        )
    });
    if (existing) {
        return existing.id;
    }

    const [ newNode ] = await db.insert(schema.scenarioLocalNodes).values({
        scenarioId,
        name: name.trim()
    }).returning({ id: schema.scenarioLocalNodes.id });
    return newNode.id;
}

/**
 * Clean up local nodes that are no longer referenced by any connection
 */
export async function cleanupUnusedLocalNodes(db: Database, scenarioId: number): Promise<void> {
    const allLocalNodes = await db.query.scenarioLocalNodes.findMany({
        where: eq(schema.scenarioLocalNodes.scenarioId, scenarioId)
    });

    for (const localNode of allLocalNodes) {
        // Check if used in any connection (as source or target)
        const usedInConnection = await db.query.connections.findFirst({
            where: and(
                eq(schema.connections.scenarioId, scenarioId),
                eq(schema.connections.sourceLocalNodeId, localNode.id)
            )
        }) || await db.query.connections.findFirst({
            where: and(
                eq(schema.connections.scenarioId, scenarioId),
                eq(schema.connections.targetLocalNodeId, localNode.id)
            )
        });

        // Check if used in any group reference
        const usedInGroupRef = await db.query.scenarioGroups.findFirst({
            where: and(
                eq(schema.scenarioGroups.scenarioId, scenarioId),
                eq(schema.scenarioGroups.connectingLocalNodeId, localNode.id)
            )
        });

        // Check if used in any node reference
        const usedInNodeRef = await db.query.scenarioNodes.findFirst({
            where: and(
                eq(schema.scenarioNodes.scenarioId, scenarioId),
                eq(schema.scenarioNodes.connectingLocalNodeId, localNode.id)
            )
        });

        // If not used anywhere, delete it
        if (!usedInConnection && !usedInGroupRef && !usedInNodeRef) {
            await db.delete(schema.scenarioLocalNodes).where(
                eq(schema.scenarioLocalNodes.id, localNode.id)
            );
        }
    }
}

/**
 * Connection conversion parameters
 */
export interface ConversionParams {
    db: Database;
    scenarioId: number;
    connectionId: number;
    newType: 'local' | 'group' | 'node';
    newName: string;
    newRefId?: string;
    preservedLocalNodeId: number;
    displayOrder: number;
    /**
     * For source conversions: 'source' means the new ref flows FROM something
     * For target conversions: 'target' means the new ref flows TO something
     */
    refDirection: 'source' | 'target';
    /** Default value to use when creating a direct connection */
    defaultValue?: number;
}

/**
 * Delete the old connection and create a new one of the specified type
 */
export async function convertConnection(params: ConversionParams): Promise<void> {
    const {
        db,
        scenarioId,
        newType,
        newName,
        newRefId,
        preservedLocalNodeId,
        displayOrder,
        refDirection,
        defaultValue = 1,
    } = params;

    if (newType === 'group' && newRefId) {
        await db.insert(schema.scenarioGroups).values({
            scenarioId,
            groupId: parseInt(newRefId, 10),
            connectingLocalNodeId: preservedLocalNodeId,
            direction: refDirection,
            displayOrder
        });
    } else if (newType === 'node' && newRefId) {
        await db.insert(schema.scenarioNodes).values({
            scenarioId,
            nodeId: parseInt(newRefId, 10),
            connectingLocalNodeId: preservedLocalNodeId,
            direction: refDirection,
            displayOrder
        });
    } else {
        // Create direct connection
        const newLocalNodeId = await getOrCreateLocalNode(db, scenarioId, newName);
        if (refDirection === 'source') {
            // New node is source, preserved is target
            await db.insert(schema.connections).values({
                scenarioId,
                sourceLocalNodeId: newLocalNodeId,
                targetLocalNodeId: preservedLocalNodeId,
                value: defaultValue,
                displayOrder
            });
        } else {
            // Preserved is source, new node is target
            await db.insert(schema.connections).values({
                scenarioId,
                sourceLocalNodeId: preservedLocalNodeId,
                targetLocalNodeId: newLocalNodeId,
                value: defaultValue,
                displayOrder
            });
        }
    }
}
