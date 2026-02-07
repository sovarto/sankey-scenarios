/**
 * Action handlers for scenario view page
 */

import { eq, and } from 'drizzle-orm';
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

    // Handle node references
    if (sourceType === 'node' && sourceRefId) {
        const nodeId = parseInt(sourceRefId as string, 10);
        const connectingLocalNodeId = await getOrCreateLocalNode(db, scenarioId, target as string);
        await db.insert(schema.scenarioNodes).values({
            scenarioId,
            nodeId,
            connectingLocalNodeId,
            direction: 'source'
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
            direction: 'target'
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
            showGroupNode: showGroupNodeValue
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
            showGroupNode: showGroupNodeValue
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
        autoValue: isAutoValue ? 1 : 0
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

export async function handlePromoteToProjectNode(ctx: ActionContext): Promise<ActionResult> {
    const { db, projectId, scenarioId, formData } = ctx;

    const localNodeId = formData.get('localNodeId');
    const value = formData.get('value');

    if (typeof localNodeId !== 'string' || typeof value !== 'string') {
        return { error: 'Local node ID and value are required' };
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
        return { error: 'Value must be a positive number' };
    }

    const localNode = await db.query.scenarioLocalNodes.findFirst({
        where: and(
            eq(schema.scenarioLocalNodes.id, parseInt(localNodeId, 10)),
            eq(schema.scenarioLocalNodes.scenarioId, scenarioId)
        )
    });

    if (!localNode) {
        return { error: 'Local node not found' };
    }

    // Check if a project node with this name already exists
    const existingNode = await db.query.nodes.findFirst({
        where: and(
            eq(schema.nodes.projectId, projectId),
            eq(schema.nodes.name, localNode.name)
        )
    });

    if (existingNode) {
        return { error: `A project node named "${localNode.name}" already exists` };
    }

    // Create the project node
    const [ newProjectNode ] = await db.insert(schema.nodes).values({
        projectId,
        name: localNode.name,
        value: numValue
    }).returning({ id: schema.nodes.id });

    await db.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, projectId));

    return { success: true };
}

export async function handleAddLocalNodesToGroup(ctx: ActionContext): Promise<ActionResult> {
    const { db, projectId, scenarioId, formData } = ctx;

    const localNodeIdsJson = formData.get('localNodeIds');
    const groupIdStr = formData.get('groupId');
    const value = formData.get('value');

    if (typeof localNodeIdsJson !== 'string' || typeof groupIdStr !== 'string' || typeof value !== 'string') {
        return { error: 'Local node IDs, group ID, and value are required' };
    }

    const groupId = parseInt(groupIdStr, 10);
    const numValue = parseFloat(value);

    if (isNaN(groupId)) {
        return { error: 'Invalid group ID' };
    }

    if (isNaN(numValue) || numValue <= 0) {
        return { error: 'Value must be a positive number' };
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
        where: and(
            eq(schema.scenarioLocalNodes.scenarioId, scenarioId)
        )
    });

    const nodesToAdd = localNodes.filter(n => localNodeIds.includes(n.id));

    if (nodesToAdd.length === 0) {
        return { error: 'No valid local nodes found' };
    }

    // Add each local node as a connection to the group
    for (const localNode of nodesToAdd) {
        await db.insert(schema.connections).values({
            groupId,
            source: localNode.name,
            target: localNode.name,
            value: numValue
        });
    }

    await db.update(schema.groups).set({ updatedAt: new Date() }).where(eq(schema.groups.id, groupId));
    await db.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, projectId));

    return { success: true };
}

export async function handleAddLocalNodesToNewGroup(ctx: ActionContext): Promise<ActionResult> {
    const { db, projectId, scenarioId, formData } = ctx;

    const localNodeIdsJson = formData.get('localNodeIds');
    const groupName = formData.get('groupName');
    const value = formData.get('value');

    if (typeof localNodeIdsJson !== 'string' || typeof groupName !== 'string' || typeof value !== 'string') {
        return { error: 'Local node IDs, group name, and value are required' };
    }

    if (!groupName.trim()) {
        return { error: 'Group name is required' };
    }

    const numValue = parseFloat(value);

    if (isNaN(numValue) || numValue <= 0) {
        return { error: 'Value must be a positive number' };
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

    // Create the new group
    const [ newGroup ] = await db.insert(schema.groups).values({
        projectId,
        name: groupName.trim()
    }).returning({ id: schema.groups.id });

    // Add each local node as a connection to the new group
    for (const localNode of nodesToAdd) {
        await db.insert(schema.connections).values({
            groupId: newGroup.id,
            source: localNode.name,
            target: localNode.name,
            value: numValue
        });
    }

    await db.update(schema.projects).set({ updatedAt: new Date() }).where(eq(schema.projects.id, projectId));

    return { success: true };
}
