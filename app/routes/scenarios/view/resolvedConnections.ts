/**
 * Resolved connection type for Sankey diagram
 */
export interface ResolvedConnection {
    source: string;
    target: string;
    value: number;
    color?: string;
    /** Custom display label for source node */
    sourceDisplayName?: string;
    /** Custom display label for target node */
    targetDisplayName?: string;
    /** Explicit color for source node */
    sourceNodeColor?: string;
    /** Explicit color for target node */
    targetNodeColor?: string;
    fromGroup?: string;
    fromNode?: string;
}

/** Color for "Missing" flows (bright red) - when outgoing > incoming */
const MISSING_COLOR = '#ff0000';
/** Color for "Remaining" flows (bright green) - when incoming > outgoing */
const REMAINING_COLOR = '#00cc00';

/**
 * Scenario data returned from loader with all relationships
 */
export type ScenarioWithRelations = {
    id: number;
    name: string;
    description: string | null;
    localNodes: Array<{ id: number; name: string }>;
    connections: Array<{
        id: number;
        value: number;
        displayOrder: number;
        source?: string | null;
        target?: string | null;
        sourceLocalNode?: { id: number; name: string } | null;
        targetLocalNode?: { id: number; name: string } | null;
    }>;
    groupReferences: Array<{
        id: number;
        direction: string;
        displayOrder: number;
        showGroupNode: number;
        group: {
            id: number;
            name: string;
            connections: Array<{
                source?: string | null;
                target?: string | null;
                value: number;
            }>;
        };
        connectingLocalNode: { id: number; name: string };
    }>;
    nodeReferences: Array<{
        id: number;
        direction: string;
        displayOrder: number;
        node: { id: number; name: string; value: number };
        connectingLocalNode: { id: number; name: string };
    }>;
};

type ConnectionSource = { type: 'direct'; data: ScenarioWithRelations['connections'][number] } | {
    type: 'group';
    data: ScenarioWithRelations['groupReferences'][number];
} | { type: 'node'; data: ScenarioWithRelations['nodeReferences'][number] };

/**
 * Build resolved connections from scenario data for the Sankey diagram
 */
export function buildResolvedConnections(scenario: ScenarioWithRelations): ResolvedConnection[] {
    // Build a unified ordered list of all connection sources
    const allConnectionSources: ConnectionSource[] = [
        ...scenario.connections.map(c => ({ type: 'direct' as const, data: c })),
        ...scenario.groupReferences.map(g => ({ type: 'group' as const, data: g })),
        ...scenario.nodeReferences.map(n => ({ type: 'node' as const, data: n })),
    ].sort((a, b) => a.data.displayOrder - b.data.displayOrder);

    const resolvedConnections: ResolvedConnection[] = [];

    for (const item of allConnectionSources) {
        if (item.type === 'direct') {
            resolvedConnections.push(...resolveDirectConnection(item.data));
        } else if (item.type === 'group') {
            resolvedConnections.push(...resolveGroupReference(item.data));
        } else {
            resolvedConnections.push(...resolveNodeReference(item.data));
        }
    }

    return resolvedConnections;
}

function resolveDirectConnection(conn: ScenarioWithRelations['connections'][number]): ResolvedConnection[] {
    const sourceName = conn.sourceLocalNode?.name ?? conn.source ?? '';
    const targetName = conn.targetLocalNode?.name ?? conn.target ?? '';
    return [ {
        source: sourceName,
        target: targetName,
        value: conn.value
    } ];
}

function resolveGroupReference(groupRef: ScenarioWithRelations['groupReferences'][number]): ResolvedConnection[] {
    const connections: ResolvedConnection[] = [];
    const connectingNodeName = groupRef.connectingLocalNode.name;
    const showGroupNode = groupRef.showGroupNode === 1;
    const groupNodeName = groupRef.group.name;

    if (showGroupNode) {
        const totalValue = groupRef.group.connections.reduce((sum, c) => sum + c.value, 0);

        if (groupRef.direction === 'source') {
            // connectingNode → groupNode (one aggregated connection)
            connections.push({
                source: connectingNodeName,
                target: groupNodeName,
                value: totalValue,
                fromGroup: groupRef.group.name
            });
            // groupNode → each group item
            for (const conn of groupRef.group.connections) {
                connections.push({
                    source: groupNodeName,
                    target: conn.target ?? '',
                    value: conn.value,
                    fromGroup: groupRef.group.name
                });
            }
        } else {
            // each group item → groupNode
            for (const conn of groupRef.group.connections) {
                connections.push({
                    source: conn.source ?? '',
                    target: groupNodeName,
                    value: conn.value,
                    fromGroup: groupRef.group.name
                });
            }
            // groupNode → connectingNode (one aggregated connection)
            connections.push({
                source: groupNodeName,
                target: connectingNodeName,
                value: totalValue,
                fromGroup: groupRef.group.name
            });
        }
    } else {
        // No intermediate group node - direct connections
        for (const conn of groupRef.group.connections) {
            if (groupRef.direction === 'source') {
                connections.push({
                    source: connectingNodeName,
                    target: conn.target ?? '',
                    value: conn.value,
                    fromGroup: groupRef.group.name
                });
            } else {
                connections.push({
                    source: conn.source ?? '',
                    target: connectingNodeName,
                    value: conn.value,
                    fromGroup: groupRef.group.name
                });
            }
        }
    }

    return connections;
}

function resolveNodeReference(nodeRef: ScenarioWithRelations['nodeReferences'][number]): ResolvedConnection[] {
    const connectingNodeName = nodeRef.connectingLocalNode.name;
    if (nodeRef.direction === 'source') {
        return [ {
            source: nodeRef.node.name,
            target: connectingNodeName,
            value: nodeRef.node.value,
            fromNode: nodeRef.node.name
        } ];
    } else {
        return [ {
            source: connectingNodeName,
            target: nodeRef.node.name,
            value: nodeRef.node.value,
            fromNode: nodeRef.node.name
        } ];
    }
}
/**
 * Add balancing flows for nodes where incoming and outgoing values don't match.
 * - If incoming > outgoing: add an outgoing flow to "Remaining" (greenish)
 * - If outgoing > incoming: add an incoming flow from "Missing" (reddish)
 *
 * Each Missing/Remaining node is unique per source/target node to avoid merging them all.
 */
export function addBalancingFlows(connections: ResolvedConnection[]): ResolvedConnection[] {
    // Calculate incoming and outgoing totals for each node
    const nodeBalance = new Map<string, { incoming: number; outgoing: number }>();

    for (const conn of connections) {
        // Update source node outgoing
        if (!nodeBalance.has(conn.source)) {
            nodeBalance.set(conn.source, { incoming: 0, outgoing: 0 });
        }
        nodeBalance.get(conn.source)!.outgoing += conn.value;

        // Update target node incoming
        if (!nodeBalance.has(conn.target)) {
            nodeBalance.set(conn.target, { incoming: 0, outgoing: 0 });
        }
        nodeBalance.get(conn.target)!.incoming += conn.value;
    }

    // Find nodes that need balancing (exclude pure sources and pure sinks)
    const balancingFlows: ResolvedConnection[] = [];

    for (const [ nodeName, balance ] of nodeBalance) {
        // Skip nodes that are already balancing nodes (have _Missing_ or _Remaining_ prefix)
        if (nodeName.startsWith('_Missing_') || nodeName.startsWith('_Remaining_')) {
            continue;
        }

        // Only balance nodes that have both incoming and outgoing connections
        // (pure sources/sinks don't need balancing)
        if (balance.incoming > 0 && balance.outgoing > 0) {
            const diff = balance.incoming - balance.outgoing;

            if (diff > 0) {
                // More incoming than outgoing - add flow to a unique "Remaining" node
                balancingFlows.push({
                    source: nodeName,
                    target: `_Remaining_${nodeName}`,
                    targetDisplayName: 'Remaining',
                    targetNodeColor: REMAINING_COLOR,
                    value: diff,
                    color: REMAINING_COLOR
                });
            } else if (diff < 0) {
                // More outgoing than incoming - add flow from a unique "Missing" node
                balancingFlows.push({
                    source: `_Missing_${nodeName}`,
                    sourceDisplayName: 'Missing',
                    sourceNodeColor: MISSING_COLOR,
                    target: nodeName,
                    value: Math.abs(diff),
                    color: MISSING_COLOR
                });
            }
        }
    }

    return [ ...connections, ...balancingFlows ];
}
