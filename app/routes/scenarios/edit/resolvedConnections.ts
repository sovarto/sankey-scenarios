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
    /** Value type: 'percent' means the stored value is a percentage of total incoming to source node */
    valueType?: 'absolute' | 'percent';
    /** Original percentage value (stored when valueType is 'percent' before resolution) */
    percentValue?: number;
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
        valueType?: string | null;
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
        valueType: string | null;
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
        nodeOrders?: Array<{ nodeName: string; displayOrder: number }>;
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
    const valueType = conn.valueType === 'percent' ? 'percent' : 'absolute';

    return [ {
        source: sourceName,
        target: targetName,
        value: conn.value,
        valueType,
        percentValue: valueType === 'percent' ? conn.value : undefined,
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

    // Build a map of node order overrides for this group reference
    const nodeOrderMap = new Map<string, number>();
    if (groupRef.nodeOrders) {
        for (const order of groupRef.nodeOrders) {
            nodeOrderMap.set(order.nodeName, order.displayOrder);
        }
    }

    // Sort group connections by per-scenario order if available, otherwise by original order
    const sortedConnections = [ ...groupRef.group.connections ].sort((a, b) => {
        // Get the relevant node name based on direction
        const aNodeName = groupRef.direction === 'source' ? (a.target ?? '') : (a.source ?? '');
        const bNodeName = groupRef.direction === 'source' ? (b.target ?? '') : (b.source ?? '');

        const aOrder = nodeOrderMap.get(aNodeName);
        const bOrder = nodeOrderMap.get(bNodeName);

        // If both have overrides, sort by override
        if (aOrder !== undefined && bOrder !== undefined) {
            return aOrder - bOrder;
        }
        // If only one has override, it comes first
        if (aOrder !== undefined) {
            return -1;
        }
        if (bOrder !== undefined) {
            return 1;
        }
        // If neither has override, maintain original order (stable sort)
        return 0;
    });

    // If subNode is specified, only connect to that specific node (showGroupNode is ignored)
    // This works like a direct connection with value, autoValue, placeholderType, and valueType support
    if (subNode) {
        // Find matching connections in the group to calculate default value
        const matchingConnections = sortedConnections.filter(conn => {
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
        const valueType = groupRef.valueType === 'percent' ? 'percent' : 'absolute';

        if (groupRef.direction === 'source') {
            // connectingNode → subNode
            connections.push({
                source: connectingNodeName,
                target: subNode,
                value,
                valueType,
                percentValue: valueType === 'percent' ? value : undefined,
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
                valueType,
                percentValue: valueType === 'percent' ? value : undefined,
                fromGroup: groupRef.group.name,
                autoValue: autoValue || undefined,
                placeholderType
            });
        }

        return connections;
    }

    // Original behavior when no subNode is specified (now using sorted connections)
    if (showGroupNode) {
        const totalValue = sortedConnections.reduce((sum, c) => sum + c.value, 0);

        if (groupRef.direction === 'source') {
            // connectingNode → groupNode (one aggregated connection)
            connections.push({
                source: connectingNodeName,
                target: groupNodeName,
                value: totalValue,
                fromGroup: groupRef.group.name
            });
            // groupNode → each group item (in sorted order)
            for (const conn of sortedConnections) {
                connections.push({
                    source: groupNodeName,
                    target: conn.target ?? '',
                    value: conn.value,
                    fromGroup: groupRef.group.name
                });
            }
        } else {
            // each group item → groupNode (in sorted order)
            for (const conn of sortedConnections) {
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
        // No intermediate group node - direct connections (in sorted order)
        for (const conn of sortedConnections) {
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
 * Also resolves auto-value and percentage connections where the value is calculated as:
 * - Auto: 100% of total incoming to the source node
 * - Percent: specified percentage of total incoming to the source node
 *
 * User-defined placeholders keep their exact position in the list.
 * Auto-generated balancing flows are inserted after the last connection involving the node.
 */
export function addBalancingFlows(connections: ResolvedConnection[]): ResolvedConnection[] {
    // We need to resolve everything iteratively because:
    // 1. Placeholder values depend on node balance (incoming - outgoing)
    // 2. Auto/percent values depend on total incoming to source node
    // 3. Placeholder flows contribute to incoming totals for their target nodes
    // So we iterate until all values are stable

    let resolvedConnections = [ ...connections ];

    // Track resolved placeholder values (keyed by original connection index)
    const placeholderValues = new Map<number, number>();

    let changed = true;
    const maxIterations = 100;
    let iterations = 0;

    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;

        // First, calculate balance for each node to determine placeholder values
        // Include: regular connections, resolved auto/percent values
        // For placeholders:
        // - Remaining: include contribution to TARGET's incoming (for chained placeholders),
        //   but NOT to SOURCE's outgoing (to avoid feedback loop - we calculate remaining based on source's diff)
        // - Missing: include contribution to SOURCE's outgoing (for chained placeholders),
        //   but NOT to TARGET's incoming (to avoid feedback loop - we calculate missing based on target's diff)
        const nodeBalance = new Map<string, { incoming: number; outgoing: number }>();

        for (let i = 0; i < resolvedConnections.length; i++) {
            const conn = resolvedConnections[i];

            if (conn.placeholderType) {
                const resolvedValue = placeholderValues.get(i) ?? 0;
                if (resolvedValue > 0) {
                    if (conn.placeholderType === 'remaining') {
                        // Remaining: track target's incoming (for chained placeholders)
                        if (!nodeBalance.has(conn.target)) {
                            nodeBalance.set(conn.target, { incoming: 0, outgoing: 0 });
                        }
                        nodeBalance.get(conn.target)!.incoming += resolvedValue;
                    } else if (conn.placeholderType === 'missing') {
                        // Missing: track source's outgoing (for chained placeholders)
                        if (!nodeBalance.has(conn.source)) {
                            nodeBalance.set(conn.source, { incoming: 0, outgoing: 0 });
                        }
                        nodeBalance.get(conn.source)!.outgoing += resolvedValue;
                    }
                }
                continue;
            }

            // Regular connection (including auto/percent with their resolved values)
            if (!nodeBalance.has(conn.source)) {
                nodeBalance.set(conn.source, { incoming: 0, outgoing: 0 });
            }
            nodeBalance.get(conn.source)!.outgoing += conn.value;

            if (!nodeBalance.has(conn.target)) {
                nodeBalance.set(conn.target, { incoming: 0, outgoing: 0 });
            }
            nodeBalance.get(conn.target)!.incoming += conn.value;
        }

        // Calculate diffs for nodes
        // For "remaining": need incoming > outgoing (diff > 0)
        // For "missing": need outgoing > incoming (diff < 0)
        // We only need both incoming and outgoing > 0 for auto-generated flows,
        // but user-defined placeholders can work with just one side
        const nodeDiffs = new Map<string, number>();
        for (const [ nodeName, balance ] of nodeBalance) {
            if (nodeName.startsWith('_Missing_') || nodeName.startsWith('_Remaining_')) {
                continue;
            }
            // Calculate diff for any node with activity
            // diff > 0 means remaining (more incoming than outgoing)
            // diff < 0 means missing (more outgoing than incoming)
            const diff = balance.incoming - balance.outgoing;
            if (diff !== 0) {
                nodeDiffs.set(nodeName, diff);
            }
        }

        // Update placeholder values based on diffs
        for (let i = 0; i < resolvedConnections.length; i++) {
            const conn = resolvedConnections[i];
            if (!conn.placeholderType) {
                continue;
            }

            const nodeName = conn.placeholderType === 'remaining' ? conn.source : conn.target;
            const diff = nodeDiffs.get(nodeName);
            let newValue = 0;

            if (diff !== undefined) {
                if (conn.placeholderType === 'remaining' && diff > 0) {
                    newValue = diff;
                } else if (conn.placeholderType === 'missing' && diff < 0) {
                    newValue = Math.abs(diff);
                }
            }

            const oldValue = placeholderValues.get(i) ?? 0;
            if (newValue !== oldValue) {
                changed = true;
                placeholderValues.set(i, newValue);
            }
        }

        // Calculate incoming totals for each node (including resolved placeholders)
        const nodeIncoming = new Map<string, number>();
        for (const [ nodeName, balance ] of nodeBalance) {
            nodeIncoming.set(nodeName, balance.incoming);
        }
        // Add contributions from "missing" placeholders to target's incoming
        // (Note: "remaining" placeholders already have their target incoming in nodeBalance)
        for (let i = 0; i < resolvedConnections.length; i++) {
            const conn = resolvedConnections[i];
            if (conn.placeholderType === 'missing') {
                const resolvedValue = placeholderValues.get(i) ?? 0;
                if (resolvedValue > 0) {
                    // Missing placeholder contributes to target's incoming
                    nodeIncoming.set(conn.target, (nodeIncoming.get(conn.target) ?? 0) + resolvedValue);
                }
            }
        }

        // Update auto-value and percentage connections based on incoming totals
        resolvedConnections = resolvedConnections.map(conn => {
            if (conn.placeholderType) {
                return conn; // Skip placeholders, they're handled separately
            }

            if (conn.autoValue) {
                // Auto: 100% of total incoming to source node
                const sourceIncoming = nodeIncoming.get(conn.source) ?? 0;
                if (conn.value !== sourceIncoming) {
                    changed = true;
                    return { ...conn, value: sourceIncoming };
                }
            } else if (conn.valueType === 'percent' && conn.percentValue !== undefined) {
                // Percent: specified percentage of total incoming to source node
                const sourceIncoming = nodeIncoming.get(conn.source) ?? 0;
                const newValue = (sourceIncoming * conn.percentValue) / 100;
                if (conn.value !== newValue) {
                    changed = true;
                    return { ...conn, value: newValue };
                }
            }
            return conn;
        });
    }

    // Track last indices for auto-generated flow insertion
    const lastSourceIndex = new Map<string, number>();
    const lastTargetIndex = new Map<string, number>();
    for (let i = 0; i < resolvedConnections.length; i++) {
        const conn = resolvedConnections[i];
        if (!conn.placeholderType) {
            lastSourceIndex.set(conn.source, i);
            lastTargetIndex.set(conn.target, i);
        }
    }

    // Recalculate final diffs for auto-generated flows
    const finalNodeBalance = new Map<string, { incoming: number; outgoing: number }>();
    for (let i = 0; i < resolvedConnections.length; i++) {
        const conn = resolvedConnections[i];
        let source = conn.source;
        let target = conn.target;
        let value = conn.value;

        if (conn.placeholderType) {
            value = placeholderValues.get(i) ?? 0;
            if (value <= 0) {
                continue;
            }
        }

        if (!finalNodeBalance.has(source)) {
            finalNodeBalance.set(source, { incoming: 0, outgoing: 0 });
        }
        finalNodeBalance.get(source)!.outgoing += value;

        if (!finalNodeBalance.has(target)) {
            finalNodeBalance.set(target, { incoming: 0, outgoing: 0 });
        }
        finalNodeBalance.get(target)!.incoming += value;
    }

    const finalNodeDiffs = new Map<string, number>();
    for (const [ nodeName, balance ] of finalNodeBalance) {
        if (nodeName.startsWith('_Missing_') || nodeName.startsWith('_Remaining_')) {
            continue;
        }
        if (balance.incoming > 0 && balance.outgoing > 0) {
            const diff = balance.incoming - balance.outgoing;
            if (diff !== 0) {
                finalNodeDiffs.set(nodeName, diff);
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
            // User-defined placeholder - convert to balancing flow
            const resolvedValue = placeholderValues.get(i) ?? 0;
            if (resolvedValue > 0) {
                if (conn.placeholderType === 'remaining') {
                    result.push({
                        source: conn.source,
                        target: conn.target,
                        value: resolvedValue,
                        color: REMAINING_COLOR,
                        targetNodeColor: REMAINING_COLOR
                    });
                    handledNodes.add(conn.source);
                } else if (conn.placeholderType === 'missing') {
                    result.push({
                        source: conn.source,
                        target: conn.target,
                        value: resolvedValue,
                        color: MISSING_COLOR,
                        sourceNodeColor: MISSING_COLOR
                    });
                    handledNodes.add(conn.target);
                }
            }
            // If value is 0, skip the placeholder silently
        } else {
            // Regular connection - add as-is (with resolved auto/percent value)
            result.push(conn);
        }
    }

    // Collect auto-generated flows for nodes that still need balancing
    const autoFlows: Array<{ flow: ResolvedConnection; insertAfter: number }> = [];

    for (const [ nodeName, diff ] of finalNodeDiffs) {
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
    const originalToResultIndex: number[] = [];
    let resultIdx = 0;
    for (let i = 0; i < resolvedConnections.length; i++) {
        if (resolvedConnections[i].placeholderType) {
            const resolvedValue = placeholderValues.get(i) ?? 0;
            if (resolvedValue > 0) {
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
