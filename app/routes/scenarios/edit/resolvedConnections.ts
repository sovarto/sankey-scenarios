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
    /** Placeholder type: 'missing' or 'remaining' - value will be calculated */
    placeholderType?: 'missing' | 'remaining' | null;
    /** Auto value: if true, value is calculated as total incoming to the source node */
    autoValue?: boolean;
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
        placeholderType?: string | null;
        autoValue?: number | null;
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
        subNode: string | null;
        value: number | null;
        autoValue: number | null;
        placeholderType: string | null;
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
    const placeholderType = conn.placeholderType === 'missing' || conn.placeholderType === 'remaining'
        ? conn.placeholderType
        : null;
    const autoValue = conn.autoValue === 1;

    return [ {
        source: sourceName,
        target: targetName,
        value: conn.value,
        placeholderType,
        autoValue: autoValue || undefined
    } ];
}

function resolveGroupReference(groupRef: ScenarioWithRelations['groupReferences'][number]): ResolvedConnection[] {
    const connections: ResolvedConnection[] = [];
    const connectingNodeName = groupRef.connectingLocalNode.name;
    const showGroupNode = groupRef.showGroupNode === 1;
    const groupNodeName = groupRef.group.name;
    const subNode = groupRef.subNode;

    // If subNode is specified, only connect to that specific node (showGroupNode is ignored)
    // This works like a direct connection with value, autoValue, and placeholderType support
    if (subNode) {
        // Find matching connections in the group to calculate default value
        const matchingConnections = groupRef.group.connections.filter(conn => {
            if (groupRef.direction === 'source') {
                // We're the source, group items are targets - filter by target name
                return conn.target === subNode;
            } else {
                // We're the target, group items are sources - filter by source name
                return conn.source === subNode;
            }
        });

        // Use custom value if set, otherwise calculate from group connections
        const defaultValue = matchingConnections.reduce((sum, c) => sum + c.value, 0);
        const value = groupRef.value ?? defaultValue;
        const autoValue = groupRef.autoValue === 1;
        const placeholderType = groupRef.placeholderType === 'remaining' ? 'remaining' : null;

        if (groupRef.direction === 'source') {
            // connectingNode → subNode
            connections.push({
                source: connectingNodeName,
                target: subNode,
                value,
                fromGroup: groupRef.group.name,
                autoValue: autoValue || undefined,
                placeholderType
            });
        } else {
            // subNode → connectingNode
            connections.push({
                source: subNode,
                target: connectingNodeName,
                value,
                fromGroup: groupRef.group.name,
                autoValue: autoValue || undefined,
                placeholderType
            });
        }

        return connections;
    }

    // Original behavior when no subNode is specified
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
 * Also resolves auto-value connections where the value is calculated as the
 * total incoming to the source node.
 *
 * User-defined placeholders keep their exact position in the list.
 * Auto-generated balancing flows are inserted after the last connection involving the node.
 */
export function addBalancingFlows(connections: ResolvedConnection[]): ResolvedConnection[] {
    // Resolve auto-value connections iteratively
    // Auto-values depend on the total incoming to their source node, which may include other auto-values
    // We iterate until all auto-values are stable

    let resolvedConnections = [ ...connections ];
    let changed = true;
    const maxIterations = 100; // Safety limit to prevent infinite loops
    let iterations = 0;

    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;

        // Calculate incoming totals for each node (excluding placeholders, but INCLUDING resolved auto-values)
        const nodeIncoming = new Map<string, number>();

        for (const conn of resolvedConnections) {
            if (conn.placeholderType) {
                continue; // Skip placeholders
            }
            // Include the connection's value (auto-values will use their current resolved value)
            nodeIncoming.set(conn.target, (nodeIncoming.get(conn.target) ?? 0) + conn.value);
        }

        // Update auto-value connections based on current incoming totals
        resolvedConnections = resolvedConnections.map(conn => {
            if (conn.autoValue) {
                const sourceIncoming = nodeIncoming.get(conn.source) ?? 0;
                if (conn.value !== sourceIncoming) {
                    changed = true;
                    return { ...conn, value: sourceIncoming };
                }
            }
            return conn;
        });
    }

    // Second pass: Calculate full balance for each node (excluding placeholders)
    const nodeBalance = new Map<string, { incoming: number; outgoing: number }>();
    const lastSourceIndex = new Map<string, number>();
    const lastTargetIndex = new Map<string, number>();

    for (let i = 0; i < resolvedConnections.length; i++) {
        const conn = resolvedConnections[i];
        if (conn.placeholderType) {
            continue; // Skip placeholders for balance calculation
        }

        // Update source node outgoing
        if (!nodeBalance.has(conn.source)) {
            nodeBalance.set(conn.source, { incoming: 0, outgoing: 0 });
        }
        nodeBalance.get(conn.source)!.outgoing += conn.value;
        lastSourceIndex.set(conn.source, i);

        // Update target node incoming
        if (!nodeBalance.has(conn.target)) {
            nodeBalance.set(conn.target, { incoming: 0, outgoing: 0 });
        }
        nodeBalance.get(conn.target)!.incoming += conn.value;
        lastTargetIndex.set(conn.target, i);
    }

    // Calculate which nodes need balancing and what their diff is
    const nodeDiffs = new Map<string, number>();
    for (const [ nodeName, balance ] of nodeBalance) {
        if (nodeName.startsWith('_Missing_') || nodeName.startsWith('_Remaining_')) {
            continue;
        }
        if (balance.incoming > 0 && balance.outgoing > 0) {
            const diff = balance.incoming - balance.outgoing;
            if (diff !== 0) {
                nodeDiffs.set(nodeName, diff);
            }
        }
    }

    // Track which nodes have been handled by user-defined placeholders
    const handledNodes = new Set<string>();

    // Build result array - process connections in order, converting placeholders in place
    const result: ResolvedConnection[] = [];

    for (let i = 0; i < resolvedConnections.length; i++) {
        const conn = resolvedConnections[i];

        if (conn.placeholderType) {
            // User-defined placeholder - convert to balancing flow at this exact position
            const nodeName = conn.placeholderType === 'remaining' ? conn.source : conn.target;
            const diff = nodeDiffs.get(nodeName);

            if (diff !== undefined) {
                if (conn.placeholderType === 'remaining' && diff > 0) {
                    // Node needs remaining flow
                    result.push({
                        source: nodeName,
                        target: `_Remaining_${nodeName}_${conn.target}`,
                        targetDisplayName: conn.target,
                        targetNodeColor: REMAINING_COLOR,
                        value: diff,
                        color: REMAINING_COLOR
                    });
                    handledNodes.add(nodeName);
                } else if (conn.placeholderType === 'missing' && diff < 0) {
                    // Node needs missing flow
                    result.push({
                        source: `_Missing_${nodeName}_${conn.source}`,
                        sourceDisplayName: conn.source,
                        sourceNodeColor: MISSING_COLOR,
                        target: nodeName,
                        value: Math.abs(diff),
                        color: MISSING_COLOR
                    });
                    handledNodes.add(nodeName);
                }
                // If placeholder type doesn't match what's needed, skip it silently
            }
        } else {
            // Regular connection - add as-is (with resolved auto-value)
            result.push(conn);
        }
    }

    // Collect auto-generated flows for nodes that still need balancing
    const autoFlows: Array<{ flow: ResolvedConnection; insertAfter: number }> = [];

    for (const [ nodeName, diff ] of nodeDiffs) {
        if (handledNodes.has(nodeName)) {
            continue;
        }

        if (diff > 0) {
            // Need Remaining flow - insert after last outgoing
            const insertAfter = lastSourceIndex.get(nodeName) ?? resolvedConnections.length - 1;
            autoFlows.push({
                flow: {
                    source: nodeName,
                    target: `_Remaining_${nodeName}`,
                    targetDisplayName: 'Remaining',
                    targetNodeColor: REMAINING_COLOR,
                    value: diff,
                    color: REMAINING_COLOR
                },
                insertAfter
            });
        } else if (diff < 0) {
            // Need Missing flow - insert after last incoming
            const insertAfter = lastTargetIndex.get(nodeName) ?? resolvedConnections.length - 1;
            autoFlows.push({
                flow: {
                    source: `_Missing_${nodeName}`,
                    sourceDisplayName: 'Missing',
                    sourceNodeColor: MISSING_COLOR,
                    target: nodeName,
                    value: Math.abs(diff),
                    color: MISSING_COLOR
                },
                insertAfter
            });
        }
    }

    // Map original indices to result indices
    // (accounting for skipped placeholders that didn't match their node's needs)
    const originalToResultIndex: number[] = [];
    let resultIdx = 0;
    for (let i = 0; i < resolvedConnections.length; i++) {
        if (resolvedConnections[i].placeholderType) {
            const nodeName = resolvedConnections[i].placeholderType === 'remaining'
                ? resolvedConnections[i].source
                : resolvedConnections[i].target;
            if (handledNodes.has(nodeName)) {
                originalToResultIndex.push(resultIdx);
                resultIdx++;
            } else {
                // Placeholder was skipped - point to previous position
                originalToResultIndex.push(Math.max(0, resultIdx - 1));
            }
        } else {
            originalToResultIndex.push(resultIdx);
            resultIdx++;
        }
    }

    // Sort auto flows by insertAfter descending so we can insert from end to start
    // This prevents earlier insertions from affecting later indices
    autoFlows.sort((a, b) => b.insertAfter - a.insertAfter);

    // Insert auto-generated flows at their correct positions
    for (const { flow, insertAfter } of autoFlows) {
        const resultPosition = originalToResultIndex[insertAfter];
        result.splice(resultPosition + 1, 0, flow);
        // Update all mappings for positions after this insertion
        for (let i = 0; i < originalToResultIndex.length; i++) {
            if (originalToResultIndex[i] > resultPosition) {
                originalToResultIndex[i]++;
            }
        }
    }

    return result;
}

/**
 * Extract existing placeholder and auto connections for form validation
 * - 'missing': target node already has a Missing placeholder
 * - 'remaining': source node already has a Remaining placeholder
 * - 'auto': source node already has an Auto connection
 */
export function getExistingPlaceholders(
    scenario: ScenarioWithRelations,
): Array<{ nodeName: string; type: 'missing' | 'remaining' | 'auto'; connectionId?: number }> {
    const placeholders: Array<{ nodeName: string; type: 'missing' | 'remaining' | 'auto'; connectionId?: number }> = [];

    for (const conn of scenario.connections) {
        if (conn.placeholderType === 'remaining' && conn.sourceLocalNode) {
            placeholders.push({ nodeName: conn.sourceLocalNode.name, type: 'remaining', connectionId: conn.id });
        } else if (conn.placeholderType === 'missing' && conn.targetLocalNode) {
            placeholders.push({ nodeName: conn.targetLocalNode.name, type: 'missing', connectionId: conn.id });
        } else if (conn.autoValue === 1 && conn.sourceLocalNode) {
            placeholders.push({ nodeName: conn.sourceLocalNode.name, type: 'auto', connectionId: conn.id });
        }
    }

    // Also check group references with subNodes (they work like direct connections)
    for (const groupRef of scenario.groupReferences) {
        if (groupRef.subNode) {
            // For group refs with subNode, the source is the subNode (when direction === 'target')
            // or the connecting local node (when direction === 'source')
            if (groupRef.direction === 'target') {
                // subNode is the source
                if (groupRef.placeholderType === 'remaining') {
                    placeholders.push({ nodeName: groupRef.subNode, type: 'remaining', connectionId: groupRef.id });
                } else if (groupRef.autoValue === 1) {
                    placeholders.push({ nodeName: groupRef.subNode, type: 'auto', connectionId: groupRef.id });
                }
            } else {
                // connecting local node is the source
                if (groupRef.placeholderType === 'remaining') {
                    placeholders.push({
                        nodeName: groupRef.connectingLocalNode.name,
                        type: 'remaining',
                        connectionId: groupRef.id
                    });
                } else if (groupRef.autoValue === 1) {
                    placeholders.push({
                        nodeName: groupRef.connectingLocalNode.name,
                        type: 'auto',
                        connectionId: groupRef.id
                    });
                }
            }
        }
    }

    return placeholders;
}
