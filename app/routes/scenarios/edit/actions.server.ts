/**
 * Action handlers for scenario view page
 */

import { eq, and, sql } from 'drizzle-orm';
import { getOrCreateLocalNode, cleanupUnusedLocalNodes, convertConnection } from './helpers.server';
import type { database } from '~/database/context';
import * as schema from '~/database/schema';

type ActionResult = { success: true } | { error: string } | { redirect: string };

type Database = ReturnType<typeof database>;

interface ActionContext {
    db: Database;
    projectId: number;
    scenarioId: number;
    formData: FormData;
}

/**
 * Get the next displayOrder for a new connection (max of all existing + 1)
 */
async function getNextDisplayOrder(db: Database, scenarioId: number): Promise<number> {
    // Get max displayOrder from all three tables
    const [ connMax ] = await db.select({ max: sql<number>`COALESCE(MAX(${schema.connections.displayOrder}), -1)` })
        .from(schema.connections).where(eq(schema.connections.scenarioId, scenarioId));

    const [ nodeMax ] = await db.select({ max: sql<number>`COALESCE(MAX(${schema.scenarioNodes.displayOrder}), -1)` })
        .from(schema.scenarioNodes).where(eq(schema.scenarioNodes.scenarioId, scenarioId));

    const [ groupMax ] = await db.select({ max: sql<number>`COALESCE(MAX(${schema.scenarioGroups.displayOrder}), -1)` })
        .from(schema.scenarioGroups).where(eq(schema.scenarioGroups.scenarioId, scenarioId));

    return Math.max(connMax?.max ?? -1, nodeMax?.max ?? -1, groupMax?.max ?? -1) + 1;
}

// ============================================================================
// Scenario metadata actions
// ============================================================================

export async function handleUpdateName(ctx: ActionContext): Promise<ActionResult> {
    const { db, projectId, scenarioId, formData } = ctx;
    const name = formData.get('name');

    if (typeof name !== 'string' || !name.trim()) {
        return { error: 'Scenario name is required' };
    }

    await db.update(schema.scenarios).set({
        name: name.trim(),
        updatedAt: new Date()
    }).where(eq(schema.scenarios.id, scenarioId));

    await db.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, projectId));

    return { success: true };
}

export async function handleUpdateDescription(ctx: ActionContext): Promise<ActionResult> {
    const { db, projectId, scenarioId, formData } = ctx;
    const description = formData.get('description');

    await db.update(schema.scenarios).set({
        description: typeof description === 'string' ? description.trim() || null : null,
        updatedAt: new Date()
    }).where(eq(schema.scenarios.id, scenarioId));

    await db.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, projectId));

    return { success: true };
}

export async function handleDeleteScenario(ctx: ActionContext): Promise<ActionResult> {
    const { db, projectId, scenarioId } = ctx;

    await db.delete(schema.scenarios).where(eq(schema.scenarios.id, scenarioId));

    return { redirect: `/projects/${projectId}` };
}

// ============================================================================
// Connection CRUD actions
// ============================================================================

export async function handleAddConnection(ctx: ActionContext): Promise<ActionResult> {
    const { db, scenarioId, formData } = ctx;

    const source = formData.get('source');
    const target = formData.get('target');
    const value = formData.get('value');
    const sourceType = formData.get('sourceType');
    const targetType = formData.get('targetType');
    const sourceRefId = formData.get('sourceRefId');
    const targetRefId = formData.get('targetRefId');

    // Get the next displayOrder for the new connection
    const displayOrder = await getNextDisplayOrder(db, scenarioId);

    // Handle node references
    if (sourceType === 'node' && sourceRefId) {
        const nodeId = parseInt(sourceRefId as string, 10);
        const connectingLocalNodeId = await getOrCreateLocalNode(db, scenarioId, target as string);
        await db.insert(schema.scenarioNodes).values({
            scenarioId,
            nodeId,
            connectingLocalNodeId,
            direction: 'source',
            displayOrder
        });
        return { success: true };
    }

    if (targetType === 'node' && targetRefId) {
        const nodeId = parseInt(targetRefId as string, 10);
        const connectingLocalNodeId = await getOrCreateLocalNode(db, scenarioId, source as string);
        await db.insert(schema.scenarioNodes).values({
            scenarioId,
            nodeId,
            connectingLocalNodeId,
            direction: 'target',
            displayOrder
        });
        return { success: true };
    }

    // Handle group references
    if (sourceType === 'group' && sourceRefId) {
        const groupId = parseInt(sourceRefId as string, 10);
        const connectingLocalNodeId = await getOrCreateLocalNode(db, scenarioId, target as string);
        const showGroupNodeValue = formData.get('showGroupNode') === '1' ? 1 : 0;
        await db.insert(schema.scenarioGroups).values({
            scenarioId,
            groupId,
            connectingLocalNodeId,
            direction: 'target',
            showGroupNode: showGroupNodeValue,
            displayOrder
        });
        return { success: true };
    }

    if (targetType === 'group' && targetRefId) {
        const groupId = parseInt(targetRefId as string, 10);
        const connectingLocalNodeId = await getOrCreateLocalNode(db, scenarioId, source as string);
        const showGroupNodeValue = formData.get('showGroupNode') === '1' ? 1 : 0;
        await db.insert(schema.scenarioGroups).values({
            scenarioId,
            groupId,
            connectingLocalNodeId,
            direction: 'source',
            showGroupNode: showGroupNodeValue,
            displayOrder
        });
        return { success: true };
    }

    // Direct connection
    if (typeof source !== 'string' || !source.trim() || typeof target !== 'string' || !target.trim()) {
        return { error: 'Source and target are required' };
    }

    const placeholderType = formData.get('placeholderType');
    const autoValueStr = formData.get('autoValue');
    const isPlaceholder = placeholderType === 'missing' || placeholderType === 'remaining';
    const isAutoValue = autoValueStr === '1';

    // Value is required for regular connections, ignored for placeholders and auto
    let numValue = 0;
    if (!isPlaceholder && !isAutoValue) {
        const value = formData.get('value');
        numValue = value ? parseFloat(value as string) : 0;
        if (isNaN(numValue) || numValue <= 0) {
            return { error: 'Value must be a positive number' };
        }
    }

    const sourceLocalNodeId = await getOrCreateLocalNode(db, scenarioId, source);
    const targetLocalNodeId = await getOrCreateLocalNode(db, scenarioId, target);

    await db.insert(schema.connections).values({
        scenarioId,
        sourceLocalNodeId,
        targetLocalNodeId,
        value: numValue,
        placeholderType: isPlaceholder ? (placeholderType as string) : null,
        autoValue: isAutoValue ? 1 : 0,
        displayOrder
    });

    return { success: true };
}

export async function handleDeleteConnection(ctx: ActionContext): Promise<ActionResult> {
    const { db, scenarioId, formData } = ctx;
    const connectionId = formData.get('connectionId');

    if (typeof connectionId === 'string') {
        await db.delete(schema.connections).where(eq(schema.connections.id, parseInt(connectionId, 10)));
        await cleanupUnusedLocalNodes(db, scenarioId);
    }

    return { success: true };
}

export async function handleUpdateConnectionValue(ctx: ActionContext): Promise<ActionResult> {
    const { db, formData } = ctx;

    const connectionId = formData.get('connectionId');
    const value = formData.get('value');

    if (typeof connectionId !== 'string' || typeof value !== 'string') {
        return { error: 'Invalid parameters' };
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
        return { error: 'Value must be a positive number' };
    }

    await db.update(schema.connections).set({
        value: numValue
    }).where(eq(schema.connections.id, parseInt(connectionId, 10)));

    return { success: true };
}

export async function handleUpdateConnectionPlaceholderType(ctx: ActionContext): Promise<ActionResult> {
    const { db, formData } = ctx;

    const connectionId = formData.get('connectionId');
    const placeholderType = formData.get('placeholderType');

    if (typeof connectionId !== 'string') {
        return { error: 'Invalid parameters' };
    }

    // Empty string means no placeholder type (regular connection)
    const typeValue = placeholderType === 'missing' || placeholderType === 'remaining' ? placeholderType : null;

    await db.update(schema.connections).set({
        placeholderType: typeValue
    }).where(eq(schema.connections.id, parseInt(connectionId, 10)));

    return { success: true };
}

export async function handleUpdateConnectionAutoValue(ctx: ActionContext): Promise<ActionResult> {
    const { db, formData } = ctx;

    const connectionId = formData.get('connectionId');
    const autoValue = formData.get('autoValue');

    if (typeof connectionId !== 'string') {
        return { error: 'Invalid parameters' };
    }

    const autoValueInt = autoValue === '1' ? 1 : 0;

    await db.update(schema.connections).set({
        autoValue: autoValueInt,
        // Clear placeholder type when setting auto value
        placeholderType: autoValueInt === 1 ? null : undefined
    }).where(eq(schema.connections.id, parseInt(connectionId, 10)));

    return { success: true };
}

// ============================================================================
// Connection source/target update actions
// ============================================================================

interface EndpointUpdateParams {
    connectionType: string;
    connectionId: number;
    newName: string;
    newType: string;
    newRefId: string | null;
    refDirection: string;
}

function parseEndpointUpdateParams(formData: FormData, prefix: 'Source' | 'Target'): EndpointUpdateParams | null {
    const connectionType = formData.get('connectionType');
    const connectionId = formData.get('connectionId');
    const newName = formData.get(`new${prefix}Name`);
    const newType = formData.get(`new${prefix}Type`);
    const newRefId = formData.get(`new${prefix}RefId`);
    const refDirection = formData.get('refDirection');

    if (typeof connectionId !== 'string' || typeof newName !== 'string') {
        return null;
    }

    return {
        connectionType: connectionType as string,
        connectionId: parseInt(connectionId, 10),
        newName,
        newType: newType as string,
        newRefId: newRefId as string | null,
        refDirection: refDirection as string
    };
}

export async function handleUpdateConnectionSource(ctx: ActionContext): Promise<ActionResult> {
    const { db, scenarioId, formData } = ctx;

    const params = parseEndpointUpdateParams(formData, 'Source');
    if (!params) {
        return { error: 'Invalid parameters' };
    }

    const { connectionType, connectionId, newName, newType, newRefId, refDirection } = params;

    if (connectionType === 'direct') {
        await updateDirectConnectionSource(db, scenarioId, connectionId, newName, newType, newRefId);
    } else if (connectionType === 'group-ref') {
        await updateGroupRefSource(db, scenarioId, connectionId, newName, newType, newRefId, refDirection);
    } else if (connectionType === 'node-ref') {
        await updateNodeRefSource(db, scenarioId, connectionId, newName, newType, newRefId, refDirection);
    }

    await cleanupUnusedLocalNodes(db, scenarioId);
    return { success: true };
}

export async function handleUpdateConnectionTarget(ctx: ActionContext): Promise<ActionResult> {
    const { db, scenarioId, formData } = ctx;

    const params = parseEndpointUpdateParams(formData, 'Target');
    if (!params) {
        return { error: 'Invalid parameters' };
    }

    const { connectionType, connectionId, newName, newType, newRefId, refDirection } = params;

    if (connectionType === 'direct') {
        await updateDirectConnectionTarget(db, scenarioId, connectionId, newName, newType, newRefId);
    } else if (connectionType === 'group-ref') {
        await updateGroupRefTarget(db, scenarioId, connectionId, newName, newType, newRefId, refDirection);
    } else if (connectionType === 'node-ref') {
        await updateNodeRefTarget(db, scenarioId, connectionId, newName, newType, newRefId, refDirection);
    }

    await cleanupUnusedLocalNodes(db, scenarioId);
    return { success: true };
}

// Direct connection source/target updates
async function updateDirectConnectionSource(
    db: Database,
    scenarioId: number,
    connectionId: number,
    newName: string,
    newType: string,
    newRefId: string | null,
): Promise<void> {
    if ((newType === 'group' || newType === 'node') && newRefId) {
        const existing = await db.query.connections.findFirst({
            where: eq(schema.connections.id, connectionId)
        });
        if (existing) {
            await db.delete(schema.connections).where(eq(schema.connections.id, connectionId));
            await convertConnection({
                db,
                scenarioId,
                connectionId,
                newType: newType as 'group' | 'node',
                newName,
                newRefId,
                preservedLocalNodeId: existing.targetLocalNodeId!,
                displayOrder: existing.displayOrder,
                refDirection: newType === 'group' ? 'target' : 'source'
            });
        }
    } else {
        const newLocalNodeId = await getOrCreateLocalNode(db, scenarioId, newName);
        await db.update(schema.connections).set({
            sourceLocalNodeId: newLocalNodeId
        }).where(eq(schema.connections.id, connectionId));
    }
}

async function updateDirectConnectionTarget(
    db: Database,
    scenarioId: number,
    connectionId: number,
    newName: string,
    newType: string,
    newRefId: string | null,
): Promise<void> {
    if ((newType === 'group' || newType === 'node') && newRefId) {
        const existing = await db.query.connections.findFirst({
            where: eq(schema.connections.id, connectionId)
        });
        if (existing) {
            await db.delete(schema.connections).where(eq(schema.connections.id, connectionId));
            await convertConnection({
                db,
                scenarioId,
                connectionId,
                newType: newType as 'group' | 'node',
                newName,
                newRefId,
                preservedLocalNodeId: existing.sourceLocalNodeId!,
                displayOrder: existing.displayOrder,
                refDirection: newType === 'group' ? 'source' : 'target'
            });
        }
    } else {
        const newLocalNodeId = await getOrCreateLocalNode(db, scenarioId, newName);
        await db.update(schema.connections).set({
            targetLocalNodeId: newLocalNodeId
        }).where(eq(schema.connections.id, connectionId));
    }
}

// Group reference source/target updates
async function updateGroupRefSource(
    db: Database,
    scenarioId: number,
    connectionId: number,
    newName: string,
    newType: string,
    newRefId: string | null,
    refDirection: string,
): Promise<void> {
    if (refDirection === 'source') {
        // Source IS the connecting local node - just update it
        const newLocalNodeId = await getOrCreateLocalNode(db, scenarioId, newName);
        await db.update(schema.scenarioGroups).set({
            connectingLocalNodeId: newLocalNodeId
        }).where(eq(schema.scenarioGroups.id, connectionId));
    } else {
        // Source IS the group itself - convert to different type
        const existingRef = await db.query.scenarioGroups.findFirst({
            where: eq(schema.scenarioGroups.id, connectionId),
            with: { connectingLocalNode: true }
        });
        if (existingRef) {
            await db.delete(schema.scenarioGroups).where(eq(schema.scenarioGroups.id, connectionId));
            await convertConnection({
                db,
                scenarioId,
                connectionId,
                newType: (newType === 'group' || newType === 'node') ? newType : 'local',
                newName,
                newRefId: newRefId ?? undefined,
                preservedLocalNodeId: existingRef.connectingLocalNode.id,
                displayOrder: existingRef.displayOrder,
                refDirection: 'source'
            });
        }
    }
}

async function updateGroupRefTarget(
    db: Database,
    scenarioId: number,
    connectionId: number,
    newName: string,
    newType: string,
    newRefId: string | null,
    refDirection: string,
): Promise<void> {
    if (refDirection === 'target') {
        // Target IS the connecting local node - just update it
        const newLocalNodeId = await getOrCreateLocalNode(db, scenarioId, newName);
        await db.update(schema.scenarioGroups).set({
            connectingLocalNodeId: newLocalNodeId
        }).where(eq(schema.scenarioGroups.id, connectionId));
    } else {
        // Target IS the group itself - convert to different type
        const existingRef = await db.query.scenarioGroups.findFirst({
            where: eq(schema.scenarioGroups.id, connectionId),
            with: { connectingLocalNode: true }
        });
        if (existingRef) {
            await db.delete(schema.scenarioGroups).where(eq(schema.scenarioGroups.id, connectionId));
            await convertConnection({
                db,
                scenarioId,
                connectionId,
                newType: (newType === 'group' || newType === 'node') ? newType : 'local',
                newName,
                newRefId: newRefId ?? undefined,
                preservedLocalNodeId: existingRef.connectingLocalNode.id,
                displayOrder: existingRef.displayOrder,
                refDirection: 'target'
            });
        }
    }
}

// Node reference source/target updates
async function updateNodeRefSource(
    db: Database,
    scenarioId: number,
    connectionId: number,
    newName: string,
    newType: string,
    newRefId: string | null,
    refDirection: string,
): Promise<void> {
    if (refDirection === 'target') {
        // Source IS the connecting local node - just update it
        const newLocalNodeId = await getOrCreateLocalNode(db, scenarioId, newName);
        await db.update(schema.scenarioNodes).set({
            connectingLocalNodeId: newLocalNodeId
        }).where(eq(schema.scenarioNodes.id, connectionId));
    } else {
        // Source IS the node itself - convert to different type
        const existingRef = await db.query.scenarioNodes.findFirst({
            where: eq(schema.scenarioNodes.id, connectionId),
            with: { connectingLocalNode: true, node: true }
        });
        if (existingRef) {
            await db.delete(schema.scenarioNodes).where(eq(schema.scenarioNodes.id, connectionId));
            await convertConnection({
                db,
                scenarioId,
                connectionId,
                newType: (newType === 'group' || newType === 'node') ? newType : 'local',
                newName,
                newRefId: newRefId ?? undefined,
                preservedLocalNodeId: existingRef.connectingLocalNode.id,
                displayOrder: existingRef.displayOrder,
                refDirection: 'source',
                defaultValue: existingRef.node.value
            });
        }
    }
}

async function updateNodeRefTarget(
    db: Database,
    scenarioId: number,
    connectionId: number,
    newName: string,
    newType: string,
    newRefId: string | null,
    refDirection: string,
): Promise<void> {
    if (refDirection === 'source') {
        // Target IS the connecting local node - just update it
        const newLocalNodeId = await getOrCreateLocalNode(db, scenarioId, newName);
        await db.update(schema.scenarioNodes).set({
            connectingLocalNodeId: newLocalNodeId
        }).where(eq(schema.scenarioNodes.id, connectionId));
    } else {
        // Target IS the node itself - convert to different type
        const existingRef = await db.query.scenarioNodes.findFirst({
            where: eq(schema.scenarioNodes.id, connectionId),
            with: { connectingLocalNode: true, node: true }
        });
        if (existingRef) {
            await db.delete(schema.scenarioNodes).where(eq(schema.scenarioNodes.id, connectionId));
            await convertConnection({
                db,
                scenarioId,
                connectionId,
                newType: (newType === 'group' || newType === 'node') ? newType : 'local',
                newName,
                newRefId: newRefId ?? undefined,
                preservedLocalNodeId: existingRef.connectingLocalNode.id,
                displayOrder: existingRef.displayOrder,
                refDirection: 'target',
                defaultValue: existingRef.node.value
            });
        }
    }
}

// ============================================================================
// Reference management actions
// ============================================================================

export async function handleDeleteGroupReference(ctx: ActionContext): Promise<ActionResult> {
    const { db, scenarioId, formData } = ctx;
    const referenceId = formData.get('referenceId');

    if (typeof referenceId === 'string') {
        await db.delete(schema.scenarioGroups).where(eq(schema.scenarioGroups.id, parseInt(referenceId, 10)));
        await cleanupUnusedLocalNodes(db, scenarioId);
    }

    return { success: true };
}

export async function handleDeleteNodeReference(ctx: ActionContext): Promise<ActionResult> {
    const { db, scenarioId, formData } = ctx;
    const referenceId = formData.get('referenceId');

    if (typeof referenceId === 'string') {
        await db.delete(schema.scenarioNodes).where(eq(schema.scenarioNodes.id, parseInt(referenceId, 10)));
        await cleanupUnusedLocalNodes(db, scenarioId);
    }

    return { success: true };
}

export async function handleUpdateGroupRefShowNode(ctx: ActionContext): Promise<ActionResult> {
    const { db, formData } = ctx;

    const referenceId = formData.get('referenceId');
    const showGroupNode = formData.get('showGroupNode');

    if (typeof referenceId === 'string' && typeof showGroupNode === 'string') {
        await db.update(schema.scenarioGroups).set({
            showGroupNode: showGroupNode === '1' ? 1 : 0
        }).where(eq(schema.scenarioGroups.id, parseInt(referenceId, 10)));
        return { success: true };
    }

    return { error: 'Invalid parameters' };
}

// ============================================================================
// Local node actions
// ============================================================================

export async function handleUpdateLocalNode(ctx: ActionContext): Promise<ActionResult> {
    const { db, scenarioId, formData } = ctx;

    const localNodeId = formData.get('localNodeId');
    const newName = formData.get('name');

    if (typeof localNodeId !== 'string' || typeof newName !== 'string' || !newName.trim()) {
        return { error: 'Local node ID and new name are required' };
    }

    // Check if name already exists for this scenario
    const existing = await db.query.scenarioLocalNodes.findFirst({
        where: and(
            eq(schema.scenarioLocalNodes.scenarioId, scenarioId),
            eq(schema.scenarioLocalNodes.name, newName.trim())
        )
    });

    if (existing && existing.id !== parseInt(localNodeId, 10)) {
        return { error: 'A local node with this name already exists' };
    }

    await db.update(schema.scenarioLocalNodes).set({
        name: newName.trim()
    }).where(eq(schema.scenarioLocalNodes.id, parseInt(localNodeId, 10)));

    return { success: true };
}

// ============================================================================
// Reorder action
// ============================================================================

export async function handleReorderConnections(ctx: ActionContext): Promise<ActionResult> {
    const { db, formData } = ctx;

    const orderData = formData.get('orderData');
    if (typeof orderData !== 'string') {
        return { error: 'Order data is required' };
    }

    try {
        const items: Array<{ type: string; id: number; order: number }> = JSON.parse(orderData);

        for (const item of items) {
            if (item.type === 'direct') {
                await db.update(schema.connections).set({ displayOrder: item.order }).where(
                    eq(schema.connections.id, item.id)
                );
            } else if (item.type === 'group-ref') {
                await db.update(schema.scenarioGroups).set({ displayOrder: item.order }).where(
                    eq(schema.scenarioGroups.id, item.id)
                );
            } else if (item.type === 'node-ref') {
                await db.update(schema.scenarioNodes).set({ displayOrder: item.order }).where(
                    eq(schema.scenarioNodes.id, item.id)
                );
            }
        }

        return { success: true };
    } catch {
        return { error: 'Invalid order data' };
    }
}

// ============================================================================
// Local node promotion actions
// ============================================================================

interface PromotionData {
    localNodeId: number;
    value: number;
    direction: 'source' | 'target';
    name: string;
}

export async function handlePromoteToProjectNode(ctx: ActionContext): Promise<ActionResult> {
    const { db, projectId, scenarioId, formData } = ctx;

    const promotionsJson = formData.get('promotions');

    if (typeof promotionsJson !== 'string') {
        return { error: 'Promotions data is required' };
    }

    let promotions: PromotionData[];
    try {
        promotions = JSON.parse(promotionsJson);
        if (!Array.isArray(promotions) || promotions.length === 0) {
            throw new Error('Invalid format');
        }
    } catch {
        return { error: 'Invalid promotions format' };
    }

    // Validate all promotions
    for (const promotion of promotions) {
        if (
            typeof promotion.localNodeId !== 'number'
            || typeof promotion.value !== 'number'
            || (promotion.direction !== 'source' && promotion.direction !== 'target')
        ) {
            return { error: 'Invalid promotion data' };
        }
        if (promotion.value <= 0) {
            return { error: 'Value must be a positive number' };
        }
    }

    // Check for duplicate project node names
    const names = promotions.map(p => p.name);
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
        return { error: 'Cannot promote multiple local nodes with the same name' };
    }

    // Check if any project nodes with these names already exist
    for (const name of names) {
        const existingNode = await db.query.nodes.findFirst({
            where: and(
                eq(schema.nodes.projectId, projectId),
                eq(schema.nodes.name, name)
            )
        });
        if (existingNode) {
            return { error: `A project node named "${name}" already exists` };
        }
    }

    // Process each promotion
    for (const promotion of promotions) {
        const { localNodeId: localNodeIdNum, value: numValue, direction } = promotion;

        const localNode = await db.query.scenarioLocalNodes.findFirst({
            where: and(
                eq(schema.scenarioLocalNodes.id, localNodeIdNum),
                eq(schema.scenarioLocalNodes.scenarioId, scenarioId)
            )
        });

        if (!localNode) {
            return { error: `Local node not found: ${promotion.name}` };
        }

        // Find the connection involving this local node to determine the connecting local node
        // direction='target' means node has incoming flow, so find connection where this node is the target
        // direction='source' means node has outgoing flow, so find connection where this node is the source
        let connection;
        let connectingLocalNodeId: number;

        if (direction === 'target') {
            // Local node receives flow, find connection where it's the target
            connection = await db.query.connections.findFirst({
                where: and(
                    eq(schema.connections.scenarioId, scenarioId),
                    eq(schema.connections.targetLocalNodeId, localNodeIdNum)
                )
            });
            if (!connection || !connection.sourceLocalNodeId) {
                return { error: `Could not find connection to node: ${promotion.name}` };
            }
            connectingLocalNodeId = connection.sourceLocalNodeId;
        } else {
            // Local node sends flow, find connection where it's the source
            connection = await db.query.connections.findFirst({
                where: and(
                    eq(schema.connections.scenarioId, scenarioId),
                    eq(schema.connections.sourceLocalNodeId, localNodeIdNum)
                )
            });
            if (!connection || !connection.targetLocalNodeId) {
                return { error: `Could not find connection from node: ${promotion.name}` };
            }
            connectingLocalNodeId = connection.targetLocalNodeId;
        }

        // Create the project node
        const [ newProjectNode ] = await db.insert(schema.nodes).values({
            projectId,
            name: localNode.name,
            value: numValue
        }).returning({ id: schema.nodes.id });

        // Create a scenarioNode reference linking the project node to the OTHER local node
        // Preserve the display order from the original connection
        await db.insert(schema.scenarioNodes).values({
            scenarioId,
            nodeId: newProjectNode.id,
            connectingLocalNodeId,
            direction,
            displayOrder: connection.displayOrder
        });

        // Delete the original direct connection
        await db.delete(schema.connections).where(eq(schema.connections.id, connection.id));

        // Delete the promoted local node (it's now represented by the project node)
        await db.delete(schema.scenarioLocalNodes).where(eq(schema.scenarioLocalNodes.id, localNodeIdNum));
    }

    await db.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, projectId));

    return { success: true };
}

export async function handleAddLocalNodesToGroup(ctx: ActionContext): Promise<ActionResult> {
    const { db, projectId, scenarioId, formData } = ctx;

    const localNodeIdsJson = formData.get('localNodeIds');
    const groupIdStr = formData.get('groupId');

    if (typeof localNodeIdsJson !== 'string' || typeof groupIdStr !== 'string') {
        return { error: 'Local node IDs and group ID are required' };
    }

    const groupId = parseInt(groupIdStr, 10);

    if (isNaN(groupId)) {
        return { error: 'Invalid group ID' };
    }

    let localNodeIds: number[];
    try {
        localNodeIds = JSON.parse(localNodeIdsJson);
        if (!Array.isArray(localNodeIds)) {
            throw new Error('Invalid format');
        }
    } catch {
        return { error: 'Invalid local node IDs format' };
    }

    // Verify the group belongs to this project
    const group = await db.query.groups.findFirst({
        where: and(
            eq(schema.groups.id, groupId),
            eq(schema.groups.projectId, projectId)
        )
    });

    if (!group) {
        return { error: 'Group not found' };
    }

    // Get the local nodes
    const localNodes = await db.query.scenarioLocalNodes.findMany({
        where: eq(schema.scenarioLocalNodes.scenarioId, scenarioId)
    });

    const nodesToAdd = localNodes.filter(n => localNodeIds.includes(n.id));

    if (nodesToAdd.length === 0) {
        return { error: 'No valid local nodes found' };
    }

    // Get all connections in this scenario
    const scenarioConnections = await db.query.connections.findMany({
        where: eq(schema.connections.scenarioId, scenarioId)
    });

    // Check if this group already has a reference in this scenario
    const existingGroupRef = await db.query.scenarioGroups.findFirst({
        where: and(
            eq(schema.scenarioGroups.scenarioId, scenarioId),
            eq(schema.scenarioGroups.groupId, groupId)
        )
    });

    // For each node, find its connection and determine the connecting local node
    let connectingLocalNodeId: number | null = null;
    let direction: 'source' | 'target' | null = null;
    let minDisplayOrder = Number.MAX_SAFE_INTEGER;
    const nodeConnections: Array<
        { localNode: typeof nodesToAdd[0]; connection: typeof scenarioConnections[0]; value: number }
    > = [];

    for (const localNode of nodesToAdd) {
        // Find the single connection for this local node
        const incomingConn = scenarioConnections.find(c => c.targetLocalNodeId === localNode.id);
        const outgoingConn = scenarioConnections.find(c => c.sourceLocalNodeId === localNode.id);

        let connection: typeof scenarioConnections[0] | undefined;
        let nodeDirection: 'source' | 'target';
        let nodeConnectingId: number;

        if (incomingConn && !outgoingConn) {
            // LocalNode receives flow FROM connecting node
            // So connecting node is the SOURCE, group defines targets
            connection = incomingConn;
            nodeDirection = 'source';
            nodeConnectingId = incomingConn.sourceLocalNodeId!;
        } else if (outgoingConn && !incomingConn) {
            // LocalNode sends flow TO connecting node
            // So connecting node is the TARGET, group defines sources
            connection = outgoingConn;
            nodeDirection = 'target';
            nodeConnectingId = outgoingConn.targetLocalNodeId!;
        } else {
            return {
                error: `Local node "${localNode.name}" has multiple or no connections and cannot be added to a group`
            };
        }

        // Verify all nodes connect to the same node with the same direction
        if (connectingLocalNodeId === null) {
            connectingLocalNodeId = nodeConnectingId;
            direction = nodeDirection;
        } else if (connectingLocalNodeId !== nodeConnectingId || direction !== nodeDirection) {
            return { error: 'All selected nodes must connect to the same node in the same direction' };
        }

        // If group already has a reference, verify direction matches
        if (existingGroupRef && existingGroupRef.direction !== nodeDirection) {
            return {
                error:
                    `Cannot add nodes with direction "${nodeDirection}" to a group that is already referenced with direction "${existingGroupRef.direction}"`
            };
        }

        minDisplayOrder = Math.min(minDisplayOrder, connection.displayOrder);
        const value = connection.value > 0 ? connection.value : 1;
        nodeConnections.push({ localNode, connection, value });
    }

    if (connectingLocalNodeId === null || direction === null) {
        return { error: 'Could not determine connection direction' };
    }

    // Add each local node as a connection to the group
    for (const { localNode, value } of nodeConnections) {
        await db.insert(schema.connections).values({
            groupId,
            source: localNode.name,
            target: localNode.name,
            value
        });
    }

    // Create the scenario group reference if it doesn't exist
    if (!existingGroupRef) {
        await db.insert(schema.scenarioGroups).values({
            scenarioId,
            groupId,
            connectingLocalNodeId,
            direction,
            displayOrder: minDisplayOrder
        });
    }

    // Delete the original direct connections
    for (const { connection } of nodeConnections) {
        await db.delete(schema.connections).where(eq(schema.connections.id, connection.id));
    }

    // Delete the local nodes that are now part of the group
    for (const { localNode } of nodeConnections) {
        await db.delete(schema.scenarioLocalNodes).where(eq(schema.scenarioLocalNodes.id, localNode.id));
    }

    await db.update(schema.groups).set({ updatedAt: new Date() }).where(eq(schema.groups.id, groupId));
    await db.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, projectId));

    return { success: true };
}

export async function handleAddLocalNodesToNewGroup(ctx: ActionContext): Promise<ActionResult> {
    const { db, projectId, scenarioId, formData } = ctx;

    const localNodeIdsJson = formData.get('localNodeIds');
    const groupName = formData.get('groupName');

    if (typeof localNodeIdsJson !== 'string' || typeof groupName !== 'string') {
        return { error: 'Local node IDs and group name are required' };
    }

    if (!groupName.trim()) {
        return { error: 'Group name is required' };
    }

    let localNodeIds: number[];
    try {
        localNodeIds = JSON.parse(localNodeIdsJson);
        if (!Array.isArray(localNodeIds)) {
            throw new Error('Invalid format');
        }
    } catch {
        return { error: 'Invalid local node IDs format' };
    }

    // Get the local nodes
    const localNodes = await db.query.scenarioLocalNodes.findMany({
        where: eq(schema.scenarioLocalNodes.scenarioId, scenarioId)
    });

    const nodesToAdd = localNodes.filter(n => localNodeIds.includes(n.id));

    if (nodesToAdd.length === 0) {
        return { error: 'No valid local nodes found' };
    }

    // Get all connections in this scenario
    const scenarioConnections = await db.query.connections.findMany({
        where: eq(schema.connections.scenarioId, scenarioId)
    });

    // For each node, find its connection and determine the connecting local node
    // All nodes being added to a group should have the same connecting node and direction
    let connectingLocalNodeId: number | null = null;
    let direction: 'source' | 'target' | null = null;
    let minDisplayOrder = Number.MAX_SAFE_INTEGER;
    const nodeConnections: Array<
        { localNode: typeof nodesToAdd[0]; connection: typeof scenarioConnections[0]; value: number }
    > = [];

    for (const localNode of nodesToAdd) {
        // Find the single connection for this local node
        const incomingConn = scenarioConnections.find(c => c.targetLocalNodeId === localNode.id);
        const outgoingConn = scenarioConnections.find(c => c.sourceLocalNodeId === localNode.id);

        let connection: typeof scenarioConnections[0] | undefined;
        let nodeDirection: 'source' | 'target';
        let nodeConnectingId: number;

        if (incomingConn && !outgoingConn) {
            // LocalNode receives flow FROM connecting node
            // So connecting node is the SOURCE, group defines targets
            connection = incomingConn;
            nodeDirection = 'source';
            nodeConnectingId = incomingConn.sourceLocalNodeId!;
        } else if (outgoingConn && !incomingConn) {
            // LocalNode sends flow TO connecting node
            // So connecting node is the TARGET, group defines sources
            connection = outgoingConn;
            nodeDirection = 'target';
            nodeConnectingId = outgoingConn.targetLocalNodeId!;
        } else {
            return {
                error: `Local node "${localNode.name}" has multiple or no connections and cannot be added to a group`
            };
        }

        // Verify all nodes connect to the same node with the same direction
        if (connectingLocalNodeId === null) {
            connectingLocalNodeId = nodeConnectingId;
            direction = nodeDirection;
        } else if (connectingLocalNodeId !== nodeConnectingId || direction !== nodeDirection) {
            return { error: 'All selected nodes must connect to the same node in the same direction' };
        }

        minDisplayOrder = Math.min(minDisplayOrder, connection.displayOrder);
        const value = connection.value > 0 ? connection.value : 1;
        nodeConnections.push({ localNode, connection, value });
    }

    if (connectingLocalNodeId === null || direction === null) {
        return { error: 'Could not determine connection direction' };
    }

    // Create the new group
    const [ newGroup ] = await db.insert(schema.groups).values({
        projectId,
        name: groupName.trim()
    }).returning({ id: schema.groups.id });

    // Add each local node as a connection to the new group
    for (const { localNode, value } of nodeConnections) {
        await db.insert(schema.connections).values({
            groupId: newGroup.id,
            source: localNode.name,
            target: localNode.name,
            value
        });
    }

    // Create the scenario group reference
    await db.insert(schema.scenarioGroups).values({
        scenarioId,
        groupId: newGroup.id,
        connectingLocalNodeId,
        direction,
        displayOrder: minDisplayOrder
    });

    // Delete the original direct connections
    for (const { connection } of nodeConnections) {
        await db.delete(schema.connections).where(eq(schema.connections.id, connection.id));
    }

    // Delete the local nodes that are now part of the group
    for (const { localNode } of nodeConnections) {
        await db.delete(schema.scenarioLocalNodes).where(eq(schema.scenarioLocalNodes.id, localNode.id));
    }

    await db.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, projectId));

    return { success: true };
}
