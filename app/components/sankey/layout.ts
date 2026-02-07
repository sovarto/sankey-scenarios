/**
 * Sankey Layout Engine
 *
 * Core layout algorithm for Sankey diagrams, closely following SankeyMATIC's approach.
 * Handles node positioning, stage assignment, and flow routing.
 */

import * as d3 from 'd3';
import { IN, OUT, BEFORE, AFTER, DEFAULT_CONFIG, FONT_METRICS } from './types';
import type { SankeyFlow, SankeyConfig, InternalNode, InternalFlow, SankeyDiagramData, LabelPiece, ResolvedSankeyConfig, SankeyMargin } from './types';

type AttachPosition = 'leading' | 'nearest' | 'trailing';

function getColorScale(scheme: SankeyConfig['colorScheme'], offset: number = 0): d3.ScaleOrdinal<string, string> {
    let colors: readonly string[];
    if (Array.isArray(scheme)) {
        colors = scheme;
    } else {
        switch (scheme) {
            case 'tableau10':
                colors = d3.schemeTableau10;
                break;
            case 'dark2':
                colors = d3.schemeDark2;
                break;
            case 'set3':
                colors = d3.schemeSet3;
                break;
            case 'category10':
            default:
                colors = d3.schemeCategory10;
                break;
        }
    }
    // Rotate colors by offset
    const rotated = [ ...colors.slice(offset % colors.length), ...colors.slice(0, offset % colors.length) ];
    return d3.scaleOrdinal<string>(rotated);
}

/**
 * Compute Sankey diagram layout from flow data
 */
export function computeSankeyLayout(flows: SankeyFlow[], userConfig: SankeyConfig = {}): SankeyDiagramData {
    // Merge configs with proper type narrowing
    const margin: SankeyMargin = {
        top: userConfig.margin?.top ?? DEFAULT_CONFIG.margin.top,
        right: userConfig.margin?.right ?? DEFAULT_CONFIG.margin.right,
        bottom: userConfig.margin?.bottom ?? DEFAULT_CONFIG.margin.bottom,
        left: userConfig.margin?.left ?? DEFAULT_CONFIG.margin.left
    };

    const cfg: ResolvedSankeyConfig = {
        width: userConfig.width ?? DEFAULT_CONFIG.width,
        height: userConfig.height ?? DEFAULT_CONFIG.height,
        nodeWidth: userConfig.nodeWidth ?? DEFAULT_CONFIG.nodeWidth,
        nodeHeightFactor: userConfig.nodeHeightFactor ?? DEFAULT_CONFIG.nodeHeightFactor,
        nodeSpacingFactor: userConfig.nodeSpacingFactor ?? DEFAULT_CONFIG.nodeSpacingFactor,
        nodeBorder: userConfig.nodeBorder ?? DEFAULT_CONFIG.nodeBorder,
        flowCurvature: userConfig.flowCurvature ?? DEFAULT_CONFIG.flowCurvature,
        defaultNodeColor: userConfig.defaultNodeColor ?? DEFAULT_CONFIG.defaultNodeColor,
        defaultFlowColor: userConfig.defaultFlowColor ?? DEFAULT_CONFIG.defaultFlowColor,
        nodeOpacity: userConfig.nodeOpacity ?? DEFAULT_CONFIG.nodeOpacity,
        flowOpacity: userConfig.flowOpacity ?? DEFAULT_CONFIG.flowOpacity,
        flowColorMode: userConfig.flowColorMode ?? DEFAULT_CONFIG.flowColorMode,
        justifyEnds: userConfig.justifyEnds ?? DEFAULT_CONFIG.justifyEnds,
        justifyOrigins: userConfig.justifyOrigins ?? DEFAULT_CONFIG.justifyOrigins,
        layoutOrder: userConfig.layoutOrder ?? DEFAULT_CONFIG.layoutOrder,
        attachIncompletesTo: userConfig.attachIncompletesTo ?? DEFAULT_CONFIG.attachIncompletesTo,
        iterations: userConfig.iterations ?? DEFAULT_CONFIG.iterations,
        margin,
        labels: {
            show: userConfig.labels?.show ?? DEFAULT_CONFIG.labels.show,
            fontSize: userConfig.labels?.fontSize ?? DEFAULT_CONFIG.labels.fontSize,
            fontFamily: userConfig.labels?.fontFamily ?? DEFAULT_CONFIG.labels.fontFamily,
            fontWeight: userConfig.labels?.fontWeight ?? DEFAULT_CONFIG.labels.fontWeight,
            color: userConfig.labels?.color ?? DEFAULT_CONFIG.labels.color,
            showValues: userConfig.labels?.showValues ?? DEFAULT_CONFIG.labels.showValues,
            valuePosition: userConfig.labels?.valuePosition ?? DEFAULT_CONFIG.labels.valuePosition,
            highlightOpacity: userConfig.labels?.highlightOpacity ?? DEFAULT_CONFIG.labels.highlightOpacity,
            lineSpacing: userConfig.labels?.lineSpacing ?? DEFAULT_CONFIG.labels.lineSpacing
        },
        colorScheme: userConfig.colorScheme ?? DEFAULT_CONFIG.colorScheme,
        colorSchemeOffset: userConfig.colorSchemeOffset ?? DEFAULT_CONFIG.colorSchemeOffset,
        valueFormat: {
            prefix: userConfig.valueFormat?.prefix ?? DEFAULT_CONFIG.valueFormat.prefix,
            suffix: userConfig.valueFormat?.suffix ?? DEFAULT_CONFIG.valueFormat.suffix,
            decimalPlaces: userConfig.valueFormat?.decimalPlaces ?? DEFAULT_CONFIG.valueFormat.decimalPlaces
        },
        backgroundColor: userConfig.backgroundColor ?? DEFAULT_CONFIG.backgroundColor
    };

    const graphWidth = cfg.width - margin.left - margin.right;
    const graphHeight = cfg.height - margin.top - margin.bottom;

    // Build unique nodes from flows
    const nodeMap = new Map<string, InternalNode>();
    const colorScale = getColorScale(cfg.colorScheme, cfg.colorSchemeOffset);

    let nodeIndex = 0;

    function getOrCreateNode(name: string, sourceRow: number, displayName?: string, nodeColor?: string): InternalNode {
        let node = nodeMap.get(name);
        if (!node) {
            const nodeDisplayName = displayName || name;
            node = {
                index: nodeIndex++,
                name,
                displayName: nodeDisplayName,
                tipName: nodeDisplayName.replace(/\\n/g, ' '),
                stage: 0,
                value: 0,
                color: nodeColor || colorScale(nodeDisplayName.match(/^\s*(\S+)/)?.[1] || nodeDisplayName),
                opacity: cfg.nodeOpacity,
                x: 0,
                y: 0,
                dx: cfg.nodeWidth,
                dy: 0,
                sourceRow,
                flows: { [IN]: [], [OUT]: [] },
                total: { [IN]: 0, [OUT]: 0 },
                paint: { [BEFORE]: false, [AFTER]: false }
            };
            nodeMap.set(name, node);
        } else if (node.sourceRow > sourceRow) {
            node.sourceRow = sourceRow;
        }
        return node;
    }

    // Create internal flows
    const internalFlows: InternalFlow[] = flows.map((flow, idx) => {
        const source = getOrCreateNode(flow.source, idx, flow.sourceDisplayName, flow.sourceNodeColor);
        const target = getOrCreateNode(flow.target, idx + 0.5, flow.targetDisplayName, flow.targetNodeColor);

        const internalFlow: InternalFlow = {
            index: idx,
            source,
            target,
            value: flow.value,
            color: flow.color || '',
            opacity: flow.opacity ?? cfg.flowOpacity,
            dy: 0,
            sy: 0,
            ty: 0,
            dx: 0,
            ds: 0,
            sourceRow: idx,
            useForVisiblePlacing: true
        };

        source.flows[OUT].push(internalFlow);
        target.flows[IN].push(internalFlow);

        return internalFlow;
    });

    const internalNodes = Array.from(nodeMap.values());

    // Compute node values
    computeNodeValues(internalNodes);

    // Assign nodes to stages
    const maxStage = assignNodesToStages(internalNodes, cfg.justifyOrigins, cfg.justifyEnds);

    // Create shadow nodes/flows for multi-stage connections
    createShadowNodesAndFlows(internalNodes, internalFlows);

    // Build stages array
    const stagesArr = buildStagesArray(internalNodes);

    // Position nodes
    positionNodes(
        internalNodes,
        internalFlows,
        stagesArr,
        graphWidth,
        graphHeight,
        cfg.nodeWidth,
        cfg.nodeHeightFactor / 100,
        cfg.nodeSpacingFactor / 100,
        cfg.layoutOrder === 'automatic',
        cfg.iterations,
        cfg.attachIncompletesTo
    );

    // Calculate flow positions
    positionFlows(internalNodes, internalFlows, cfg.layoutOrder === 'automatic', cfg.attachIncompletesTo);

    // Assign flow colors based on flowColorMode
    assignFlowColors(internalNodes, internalFlows, stagesArr.length, cfg);

    // Assign node border colors
    const darkBg = cfg.defaultNodeColor.toUpperCase() < '#888';
    for (const node of internalNodes) {
        if (!node.isAShadow) {
            node.borderColor = darkBg
                ? d3.rgb(node.color).brighter(2).formatHex()
                : d3.rgb(node.color).darker(2).formatHex();
        }
    }

    // Calculate label positions
    if (cfg.labels.show) {
        calculateLabelPositions(internalNodes, stagesArr.length, cfg);
    }

    return {
        nodes: internalNodes.filter(n => !n.isAShadow),
        flows: internalFlows.filter(f => !f.isAShadow),
        width: cfg.width,
        height: cfg.height,
        graphWidth,
        graphHeight,
        margin,
        config: cfg
    };
}

function computeNodeValues(nodes: InternalNode[]): void {
    for (const node of nodes) {
        node.total[IN] = d3.sum(node.flows[IN], f => f.value);
        node.total[OUT] = d3.sum(node.flows[OUT], f => f.value);
        node.value = Math.max(node.total[IN], node.total[OUT], Number.MIN_VALUE);
    }
}

/**
 * Adjust sourceRow for placeholder nodes (_Missing_ and _Remaining_) based on their
 * connected node's flow position. This ensures they appear at the correct vertical
 * position in exact layout mode.
 */
function adjustPlaceholderSourceRows(nodes: InternalNode[]): void {
    for (const node of nodes) {
        if (node.name.startsWith('_Missing_')) {
            // Missing node is SOURCE of flow going to target
            // It should be positioned based on where the flow connects on the target
            const outFlow = node.flows[OUT][0];
            if (outFlow) {
                const target = outFlow.target;
                // Find where among the target's incoming flows this one appears
                const targetInFlows = target.flows[IN].slice().sort((a, b) => a.sourceRow - b.sourceRow);
                const flowIndex = targetInFlows.indexOf(outFlow);
                if (flowIndex >= 0 && targetInFlows.length > 1) {
                    // Calculate a sourceRow that positions this node relative to other incoming flows
                    // Use the flow's sourceRow but adjust based on its position in the target's incoming flows
                    const positionRatio = flowIndex / (targetInFlows.length - 1);
                    // Get the range of sourceRows for target's incoming flows
                    const minRow = Math.min(...targetInFlows.map(f => f.source.sourceRow));
                    const maxRow = Math.max(...targetInFlows.map(f => f.source.sourceRow));
                    // Position the Missing node within that range
                    node.sourceRow = minRow + positionRatio * (maxRow - minRow + 1);
                }
            }
        } else if (node.name.startsWith('_Remaining_')) {
            // Remaining node is TARGET of flow coming from source
            // It should be positioned based on where the flow leaves the source
            const inFlow = node.flows[IN][0];
            if (inFlow) {
                const source = inFlow.source;
                // Find where among the source's outgoing flows this one appears
                const sourceOutFlows = source.flows[OUT].slice().sort((a, b) => a.sourceRow - b.sourceRow);
                const flowIndex = sourceOutFlows.indexOf(inFlow);
                if (flowIndex >= 0 && sourceOutFlows.length > 1) {
                    // Calculate a sourceRow that positions this node relative to other outgoing flows
                    const positionRatio = flowIndex / (sourceOutFlows.length - 1);
                    // Get the range of sourceRows for source's outgoing flows
                    const minRow = Math.min(...sourceOutFlows.map(f => f.target.sourceRow));
                    const maxRow = Math.max(...sourceOutFlows.map(f => f.target.sourceRow));
                    // Position the Remaining node within that range
                    node.sourceRow = minRow + positionRatio * (maxRow - minRow + 1);
                }
            }
        }
    }
}

function assignNodesToStages(nodes: InternalNode[], justifyOrigins: boolean, justifyEnds: boolean): number {
    let maxStage = -1;
    const nodesToCheck = new Set<InternalNode>();

    // Initial assignment: all nodes to stage 0
    // Then iteratively push forward based on incoming flows
    let nodesToPlace = nodes.slice();

    while (nodesToPlace.length && maxStage < nodes.length - 1) {
        maxStage++;
        for (const node of nodesToPlace) {
            node.stage = maxStage;
            for (const flow of node.flows[OUT]) {
                nodesToCheck.add(flow.target);
            }
        }
        nodesToPlace = Array.from(nodesToCheck);
        nodesToCheck.clear();
    }

    // Pull source nodes right if they have room
    const nodesWithTargets = nodes.filter(n => n.flows[OUT].length > 0).slice().sort((a, b) => b.stage - a.stage);

    for (const node of nodesWithTargets) {
        const minTargetStage = Math.min(...node.flows[OUT].map(f => f.target.stage));
        const maxNewStage = minTargetStage - 1;
        if (node.stage < maxNewStage) {
            node.stage = maxNewStage;
        }
    }

    // Justify origins to the left
    if (justifyOrigins) {
        for (const node of nodes) {
            if (node.flows[IN].length === 0) {
                node.stage = 0;
            }
        }
    }

    // Justify endpoints to the right
    if (justifyEnds) {
        for (const node of nodes) {
            if (node.flows[OUT].length === 0) {
                node.stage = maxStage;
            }
        }
    }

    return maxStage;
}

function createShadowNodesAndFlows(nodes: InternalNode[], flows: InternalFlow[]): void {
    // Calculate stage distances for all flows
    for (const flow of flows) {
        flow.ds = flow.target.stage - flow.source.stage;
    }

    // Create shadow nodes and flows for multi-stage jumps
    const shadowNodeNames = new Map<string, number>();
    const flowsToProcess = flows.filter(f => Math.abs(f.ds) > 1);

    for (const flow of flowsToProcess) {
        const nodesForThisFlow: InternalNode[] = [ flow.source ];

        for (let i = 1; i < flow.ds; i++) {
            const shadowStage = flow.source.stage + i;
            const newNodeName = `sh_${flow.source.index}_${flow.target.index}_s${shadowStage}`;
            const fVal = flow.value;

            let shadowNode: InternalNode;

            if (shadowNodeNames.has(newNodeName)) {
                shadowNode = nodes[shadowNodeNames.get(newNodeName)!];
                shadowNode.value += fVal;
                shadowNode.total[IN] += fVal;
                shadowNode.total[OUT] += fVal;
            } else {
                shadowNode = {
                    index: nodes.length,
                    name: newNodeName,
                    displayName: '',
                    tipName: '(shadow)',
                    stage: shadowStage,
                    value: fVal,
                    color: '#999',
                    opacity: 0,
                    x: 0,
                    y: 0,
                    dx: 0,
                    dy: 0,
                    sourceRow: flow.sourceRow,
                    isAShadow: true,
                    flows: { [IN]: [], [OUT]: [] },
                    total: { [IN]: fVal, [OUT]: fVal },
                    paint: { [BEFORE]: false, [AFTER]: false }
                };
                nodes.push(shadowNode);
                shadowNodeNames.set(newNodeName, shadowNode.index);
            }
            nodesForThisFlow.push(shadowNode);
        }

        nodesForThisFlow.push(flow.target);

        // Create shadow flows
        for (let i = 1; i < nodesForThisFlow.length; i++) {
            const sourceNode = nodesForThisFlow[i - 1];
            const targetNode = nodesForThisFlow[i];

            const shadowFlow: InternalFlow = {
                index: flows.length,
                source: sourceNode,
                target: targetNode,
                value: flow.value,
                color: flow.color,
                opacity: flow.opacity,
                dy: 0,
                sy: 0,
                ty: 0,
                dx: 0,
                ds: 1,
                sourceRow: flow.sourceRow + i / (flow.ds + 1),
                isAShadow: true,
                shadowOf: flow.index,
                hasAShadow: false,
                useForVisiblePlacing: sourceNode.stage === flow.source.stage || targetNode.stage === flow.target.stage,
                weightedValue: 0
            };

            flows.push(shadowFlow);
            sourceNode.flows[OUT].push(shadowFlow);
            targetNode.flows[IN].push(shadowFlow);
        }

        flow.useForVisiblePlacing = false;
        flow.hasAShadow = true;
    }
}

function buildStagesArray(nodes: InternalNode[]): InternalNode[][] {
    const groups = d3.groups(nodes, d => d.stage).sort((a, b) => a[0] - b[0]);
    return groups.map(g => g[1].sort((a, b) => a.sourceRow - b.sourceRow));
}

function positionNodes(
    nodes: InternalNode[],
    flows: InternalFlow[],
    stagesArr: InternalNode[][],
    graphWidth: number,
    graphHeight: number,
    nodeWidth: number,
    nodeHeightFactor: number,
    nodeSpacingFactor: number,
    autoLayout: boolean,
    iterations: number,
    attachIncompletesTo: AttachPosition,
): void {
    const maxStage = stagesArr.length - 1;

    // Calculate scaling factors
    const greatestNodeCount = Math.max(...stagesArr.map(s => s.length));

    let ky: number;
    let actualNodeSpacing: number;
    let maximumNodeSpacing: number;

    if (greatestNodeCount === 1) {
        maximumNodeSpacing = 0;
        actualNodeSpacing = 0;
        ky = nodeHeightFactor * Math.min(...stagesArr.map(s => {
            const sum = d3.sum(s, n => n.value);
            return sum > 0 ? graphHeight / sum : 1;
        }));
    } else {
        const allAvailablePadding = Math.max(2, graphHeight - greatestNodeCount);
        maximumNodeSpacing = ((1 - nodeHeightFactor) * allAvailablePadding) / (greatestNodeCount - 1);
        actualNodeSpacing = maximumNodeSpacing * nodeSpacingFactor;
        ky = Math.min(...stagesArr.map(s => {
            const sum = d3.sum(s, n => n.value);
            return sum > 0 ? (graphHeight - (s.length - 1) * maximumNodeSpacing) / sum : 1;
        }));
    }

    if (!isFinite(ky) || ky <= 0) {
        ky = 1;
    }

    // Set flow heights
    for (const flow of flows) {
        flow.dy = flow.value * ky;
        flow.weightedValue = flow.hasAShadow ? 0 : flow.value;
    }

    // Set node heights
    for (const node of nodes) {
        node.dy = Math.max(node.value * ky, Number.MIN_VALUE);
    }

    // Set x positions based on stages
    const widthPerStage = maxStage > 0 ? (graphWidth - nodeWidth) / maxStage : 0;
    for (const node of nodes) {
        node.x = widthPerStage * node.stage;
        node.dx = nodeWidth;
    }

    // Initial y positioning
    for (let stageIndex = 0; stageIndex < stagesArr.length; stageIndex++) {
        const stage = stagesArr[stageIndex];
        const stageSize = d3.sum(stage, n => n.dy) + actualNodeSpacing * (stage.length - 1);

        // Find center target based on incoming flows
        let targetY = graphHeight / 2;
        const allFlowsIn = stage.flatMap(n => n.flows[IN]);
        if (allFlowsIn.length > 0) {
            const uniqueSources = [ ...new Set(allFlowsIn.map(f => f.source).filter(n => n.stage >= stageIndex - 1)) ];
            if (uniqueSources.length > 0) {
                const totalValue = d3.sum(uniqueSources, n => n.value);
                const totalWeight = d3.sum(uniqueSources, n => (n.y + n.dy / 2) * n.value);
                targetY = totalValue > 0 ? totalWeight / totalValue : graphHeight / 2;
            }
        }

        let nextNodePos = Math.max(0, Math.min(targetY - stageSize / 2, graphHeight - stageSize));
        for (const node of stage) {
            node.y = nextNodePos;
            nextNodePos = node.y + node.dy + actualNodeSpacing;
        }
    }

    // Initial flow positions
    for (const node of nodes) {
        let sy = 0;
        let ty = 0;

        for (const flow of node.flows[OUT]) {
            if (flow.isAShadow && !node.isAShadow && flow.shadowOf !== undefined) {
                flow.sy = flows[flow.shadowOf].sy;
            } else {
                flow.sy = sy;
                sy += flow.dy;
            }
        }

        for (const flow of node.flows[IN]) {
            if (flow.isAShadow && !node.isAShadow && flow.shadowOf !== undefined) {
                flow.ty = flows[flow.shadowOf].ty;
            } else {
                flow.ty = ty;
                ty += flow.dy;
            }
        }
    }

    // Iterative relaxation
    let alpha = 1;
    for (let i = 0; i < iterations; i++) {
        alpha *= 0.99;

        // Forward pass
        relaxStages(stagesArr, nodes, flows, alpha, autoLayout, actualNodeSpacing, graphHeight, attachIncompletesTo);

        // Backward pass
        const reversedStages = stagesArr.slice().reverse();
        relaxStages(
            reversedStages,
            nodes,
            flows,
            alpha,
            autoLayout,
            actualNodeSpacing,
            graphHeight,
            attachIncompletesTo
        );

        // Re-center diagram
        const minY = Math.min(...nodes.map(n => n.y));
        const maxY = Math.max(...nodes.map(n => n.y + n.dy));
        const currentHeight = maxY - minY;

        if (currentHeight < graphHeight) {
            const offset = (graphHeight - currentHeight) / 2 - minY;
            for (const node of nodes) {
                node.y += offset;
            }
        }
    }

    // Remember original positions for drag support
    for (const node of nodes) {
        node.origPos = { x: node.x, y: node.y };
        node.lastPos = { x: node.x, y: node.y };
        node.move = [ 0, 0 ];
    }
}

function relaxStages(
    stages: InternalNode[][],
    nodes: InternalNode[],
    flows: InternalFlow[],
    alpha: number,
    autoLayout: boolean,
    nodeSpacing: number,
    graphHeight: number,
    attachIncompletesTo: AttachPosition,
): void {
    for (const stage of stages) {
        // Move nodes toward weighted center of their connections
        for (const node of stage) {
            const offset = computeNodeOffset(node, alpha);
            node.y += offset;
        }

        // Resolve collisions
        resolveCollisions(stage, autoLayout, nodeSpacing, graphHeight);

        // Update flow positions within nodes
        positionFlowsInStage(stage, flows, autoLayout, attachIncompletesTo);
    }
}

function computeNodeOffset(node: InternalNode, factor: number): number {
    const inWeight = d3.sum(node.flows[IN], f => f.weightedValue ?? f.value);
    const outWeight = d3.sum(node.flows[OUT], f => f.weightedValue ?? f.value);

    if (inWeight === 0 && outWeight === 0) {
        return 0;
    }

    const inCenter = inWeight > 0
        ? d3.sum(node.flows[IN], f => (f.source.y + f.sy + f.dy / 2) * (f.weightedValue ?? f.value)) / inWeight
        : 0;
    const outCenter = outWeight > 0
        ? d3.sum(node.flows[OUT], f => (f.target.y + f.ty + f.dy / 2) * (f.weightedValue ?? f.value)) / outWeight
        : 0;

    const nodeCenter = node.y + node.dy / 2;
    const totalWeight = inWeight + outWeight;
    const targetCenter = (inCenter * inWeight + outCenter * outWeight) / totalWeight;

    return (targetCenter - nodeCenter) * factor;
}

function resolveCollisions(stage: InternalNode[], autoLayout: boolean, nodeSpacing: number, graphHeight: number): void {
    // Sort by position
    if (autoLayout) {
        stage.sort((a, b) => a.y - b.y);
    } else {
        // In exact mode, we need to consider the order of flows to shared targets
        // For two nodes flowing to the same target, their order should match the flow order
        stage.sort((a, b) => {
            // Find shared targets between a and b
            const aTargets = new Set(a.flows[OUT].map(f => f.target));
            const bTargets = new Set(b.flows[OUT].map(f => f.target));

            for (const target of aTargets) {
                if (bTargets.has(target)) {
                    // Both flow to the same target - use flow order to that target
                    const aFlowToTarget = a.flows[OUT].find(f => f.target === target);
                    const bFlowToTarget = b.flows[OUT].find(f => f.target === target);
                    if (aFlowToTarget && bFlowToTarget) {
                        return aFlowToTarget.sourceRow - bFlowToTarget.sourceRow;
                    }
                }
            }

            // No shared target - fall back to minimum flow sourceRow
            const getMinSourceRow = (node: InternalNode): number => {
                const allFlows = [ ...node.flows[IN], ...node.flows[OUT] ];
                if (allFlows.length > 0) {
                    return Math.min(...allFlows.map(f => f.sourceRow));
                }
                return node.sourceRow;
            };
            return getMinSourceRow(a) - getMinSourceRow(b);
        });
    }

    // Push down from top
    let y = 0;
    for (const node of stage) {
        if (node.y < y) {
            node.y = y;
        }
        y = node.y + node.dy + nodeSpacing;
    }

    // Push up from bottom
    y = graphHeight;
    for (let i = stage.length - 1; i >= 0; i--) {
        const node = stage[i];
        if (node.y + node.dy > y) {
            node.y = y - node.dy;
        }
        y = node.y - nodeSpacing;
    }
}

/**
 * Adjust placeholder nodes (_Missing_ and _Remaining_ prefixed) to align with their connected flows.
 * This ensures user-defined placeholders appear at the correct vertical position to minimize crossings.
 */
function adjustPlaceholderNodePositions(
    nodes: InternalNode[],
    stages: InternalNode[][],
    graphHeight: number,
    nodeSpacing: number,
): void {
    // Find placeholder nodes and calculate their ideal Y position
    const adjustments: Array<{ node: InternalNode; targetY: number; stageIndex: number }> = [];

    for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
        const stage = stages[stageIndex];
        for (const node of stage) {
            if (!node.name.startsWith('_Missing_') && !node.name.startsWith('_Remaining_')) {
                continue;
            }

            // Calculate ideal Y based on connected flows
            let targetY: number | null = null;

            if (node.name.startsWith('_Missing_')) {
                // Missing node: position based on where flow connects to target
                const outFlow = node.flows[OUT][0];
                if (outFlow) {
                    // Align center of this node with where flow connects on target
                    const targetFlowY = outFlow.target.y + outFlow.ty + outFlow.dy / 2;
                    targetY = targetFlowY - node.dy / 2;
                }
            } else if (node.name.startsWith('_Remaining_')) {
                // Remaining node: position based on where flow comes from source
                const inFlow = node.flows[IN][0];
                if (inFlow) {
                    // Align center of this node with where flow leaves source
                    const sourceFlowY = inFlow.source.y + inFlow.sy + inFlow.dy / 2;
                    targetY = sourceFlowY - node.dy / 2;
                }
            }

            if (targetY !== null) {
                adjustments.push({ node, targetY, stageIndex });
            }
        }
    }

    // Apply adjustments and resolve collisions
    for (const { node, targetY, stageIndex } of adjustments) {
        node.y = Math.max(0, Math.min(graphHeight - node.dy, targetY));
    }

    // Re-resolve collisions in affected stages
    const affectedStages = new Set(adjustments.map(a => a.stageIndex));
    for (const stageIndex of affectedStages) {
        resolveCollisionsForPlaceholders(stages[stageIndex], nodeSpacing, graphHeight);
    }
}

/**
 * Resolve collisions while trying to preserve placeholder node positions
 */
function resolveCollisionsForPlaceholders(stage: InternalNode[], nodeSpacing: number, graphHeight: number): void {
    // Sort by current Y position to maintain relative order
    const sorted = [ ...stage ].sort((a, b) => a.y - b.y);

    // Push down from top
    let y = 0;
    for (const node of sorted) {
        if (node.y < y) {
            node.y = y;
        }
        y = node.y + node.dy + nodeSpacing;
    }

    // Push up from bottom
    y = graphHeight;
    for (let i = sorted.length - 1; i >= 0; i--) {
        const node = sorted[i];
        if (node.y + node.dy > y) {
            node.y = y - node.dy;
        }
        y = node.y - nodeSpacing;
    }
}

function positionFlows(
    nodes: InternalNode[],
    flows: InternalFlow[],
    autoLayout: boolean,
    attachIncompletesTo: AttachPosition,
): void {
    // Update x-distances for all flows
    for (const flow of flows) {
        flow.dx = Math.abs(flow.target.x - flow.source.x) || Number.MIN_VALUE;
    }

    // Position flows within each node
    for (const node of nodes) {
        positionFlowsInNode(node, flows, autoLayout, attachIncompletesTo);
    }
}

function positionFlowsInStage(
    stage: InternalNode[],
    flows: InternalFlow[],
    autoLayout: boolean,
    attachIncompletesTo: AttachPosition,
): void {
    for (const flow of flows) {
        flow.dx = Math.abs(flow.target.x - flow.source.x) || Number.MIN_VALUE;
    }

    for (const node of stage) {
        positionFlowsInNode(node, flows, autoLayout, attachIncompletesTo);
    }
}

function positionFlowsInNode(
    node: InternalNode,
    flows: InternalFlow[],
    autoLayout: boolean,
    attachIncompletesTo: AttachPosition,
): void {
    // Position outgoing flows
    positionFlowsOnSide(node, flows, OUT, autoLayout, attachIncompletesTo);
    // Position incoming flows
    positionFlowsOnSide(node, flows, IN, autoLayout, attachIncompletesTo);
}

function positionFlowsOnSide(
    node: InternalNode,
    flows: InternalFlow[],
    side: typeof IN | typeof OUT,
    autoLayout: boolean,
    attachIncompletesTo: AttachPosition,
): void {
    // Get flows that should be positioned at this node on this side
    // For real nodes: include flows where useForVisiblePlacing is not false
    // For shadow nodes: include all flows
    const nodeFlows = node.flows[side].filter(f => f.useForVisiblePlacing !== false || node.isAShadow);
    if (nodeFlows.length === 0) {
        return;
    }

    const totalFlowHeight = d3.sum(nodeFlows, f => f.dy);
    const totalValue = node.total[side];

    // Determine attachment position
    let attachTo: 'top' | 'bottom' = 'top';
    if (totalValue < node.value && attachIncompletesTo !== 'leading') {
        if (attachIncompletesTo === 'trailing') {
            attachTo = 'bottom';
        } else if (attachIncompletesTo === 'nearest') {
            const flowWeight = d3.sum(nodeFlows, f => {
                const otherNode = side === IN ? f.source : f.target;
                return (otherNode.y + otherNode.dy / 2) * f.value;
            });
            const avgFlowCenter = totalValue > 0 ? flowWeight / totalValue : 0;
            if (avgFlowCenter > node.y + node.dy / 2) {
                attachTo = 'bottom';
            }
        }
    }

    // Sort flows
    const sortedFlows = [ ...nodeFlows ];
    if (autoLayout) {
        sortedFlows.sort((a, b) => {
            const aOther = side === IN ? a.source : a.target;
            const bOther = side === IN ? b.source : b.target;
            return (aOther.y + aOther.dy / 2) - (bOther.y + bOther.dy / 2);
        });
    } else {
        sortedFlows.sort((a, b) => a.sourceRow - b.sourceRow);
    }

    // Position flows
    let y = attachTo === 'top' ? node.y : node.y + node.dy - totalFlowHeight;

    for (const flow of sortedFlows) {
        if (side === IN) {
            flow.ty = y - node.y;
        } else {
            flow.sy = y - node.y;
        }
        y += flow.dy;
    }
}

function assignFlowColors(
    nodes: InternalNode[],
    flows: InternalFlow[],
    totalStages: number,
    cfg: ResolvedSankeyConfig,
): void {
    const stagesMidpoint = (totalStages - 1) / 2;

    for (const flow of flows) {
        if (flow.isAShadow) {
            flow.color = '#999';
            continue;
        }

        // If flow already has a color assigned, keep it
        if (flow.color) {
            continue;
        }

        // Check for paint inheritance from source/target
        if (flow.source.paint[AFTER]) {
            flow.color = flow.source.color;
        } else if (flow.target.paint[BEFORE]) {
            flow.color = flow.target.color;
        } else {
            // Use flowColorMode
            const flowMidpoint = (flow.source.stage + flow.target.stage) / 2;
            switch (cfg.flowColorMode) {
                case 'source':
                    flow.color = flow.source.color;
                    break;
                case 'target':
                    flow.color = flow.target.color;
                    break;
                case 'outside-in':
                    flow.color = flowMidpoint <= stagesMidpoint ? flow.source.color : flow.target.color;
                    break;
                case 'none':
                default:
                    flow.color = cfg.defaultFlowColor;
                    break;
            }
        }
    }
}

function calculateLabelPositions(nodes: InternalNode[], totalStages: number, cfg: ResolvedSankeyConfig): void {
    const metrics = FONT_METRICS[cfg.labels.fontFamily] || FONT_METRICS['sans-serif'];
    const fontSize = cfg.labels.fontSize;

    // Calculate padding values for highlight backgrounds - use generous values
    const pad = {
        dy: metrics.dy * fontSize,
        top: fontSize * 0.6, // generous vertical padding
        bot: fontSize * 0.6, // generous vertical padding
        inner: fontSize * 0.5, // generous horizontal padding
        outer: fontSize * 0.5, // generous horizontal padding
        lblMarginAfter: (cfg.nodeBorder / 2) + fontSize * 0.5,
        lblMarginBefore: (cfg.nodeBorder / 2) + fontSize * 0.5
    };

    for (const node of nodes) {
        if (node.isAShadow || node.hideLabel) {
            continue;
        }

        // Determine label anchor based on node position
        let anchor: 'start' | 'end' | 'middle';
        if (node.flows[IN].length === 0) {
            anchor = 'end'; // Origins: label before node
        } else if (node.flows[OUT].length === 0) {
            anchor = 'start'; // Endpoints: label after node
        } else {
            anchor = 'middle';
        }

        // Build label pieces
        const pieces: LabelPiece[] = [];
        const displayName = node.displayName || node.name;
        const nameParts = displayName.split('\\n');
        const fontWeight = cfg.labels.fontWeight;

        if (cfg.labels.showValues) {
            const valueText = formatValue(node.value, cfg.valueFormat);

            if (cfg.labels.valuePosition === 'above' || cfg.labels.valuePosition === 'before') {
                pieces.push({
                    text: cfg.labels.valuePosition === 'before' ? valueText + ' ' : valueText,
                    size: fontSize,
                    weight: fontWeight,
                    newLine: cfg.labels.valuePosition === 'above'
                });
            }

            nameParts.forEach((part, i) => {
                pieces.push({
                    text: part || '\u00A0', // NBSP for empty lines
                    size: fontSize,
                    weight: fontWeight,
                    newLine: i > 0 || cfg.labels.valuePosition === 'above'
                });
            });

            if (cfg.labels.valuePosition === 'after') {
                pieces[pieces.length - 1].text += ': ' + valueText;
            } else if (cfg.labels.valuePosition === 'below') {
                pieces.push({
                    text: valueText,
                    size: fontSize,
                    weight: fontWeight,
                    newLine: true
                });
            }
        } else {
            nameParts.forEach((part, i) => {
                pieces.push({
                    text: part || '\u00A0',
                    size: fontSize,
                    weight: fontWeight,
                    newLine: i > 0
                });
            });
        }

        if (pieces.length === 0) {
            node.hideLabel = true;
            continue;
        }

        // Estimate label dimensions
        // Average character width varies by font: use 0.55 for sans-serif as base
        // Numbers and punctuation are narrower, uppercase letters wider
        // We measure actual max line width for more accuracy
        const lineCount = pieces.filter(p => p.newLine).length + 1;

        // Calculate width per line and find the maximum
        const lineWidths: number[] = [];
        let currentLineText = '';
        for (const piece of pieces) {
            if (piece.newLine && currentLineText) {
                lineWidths.push(currentLineText.length);
                currentLineText = piece.text;
            } else {
                currentLineText += piece.text;
            }
        }
        if (currentLineText) {
            lineWidths.push(currentLineText.length);
        }

        const maxTextLength = Math.max(...lineWidths, 0);
        // Use 0.7 em per character - generous estimate to ensure highlight covers text
        // Wide characters like 'W', 'M' can be up to 0.9em, narrow ones like 'i', 'l' around 0.3em
        const estimatedWidth = maxTextLength * fontSize * 0.7;
        // Line height for actual text rendering - use larger multiplier to account for line spacing
        const lineHeight = fontSize * 1.4;
        const estimatedHeight = lineCount * lineHeight;

        // Calculate label position
        let labelX: number;
        if (anchor === 'end') {
            labelX = node.x - pad.lblMarginBefore;
        } else if (anchor === 'start') {
            labelX = node.x + node.dx + pad.lblMarginAfter;
        } else {
            labelX = node.x + node.dx / 2;
        }

        const labelY = node.y + node.dy / 2;

        // The text will be positioned at labelY with dominant-baseline="central"
        // For multi-line text, we need to account for where all lines actually render
        const textBlockTop = labelY - (estimatedHeight / 2);
        const textBlockBottom = labelY + (estimatedHeight / 2);

        node.label = {
            anchor,
            x: labelX,
            y: labelY,
            dy: 0, // Start at center, first tspan will be offset
            pieces,
            width: estimatedWidth,
            height: estimatedHeight,
            line1Height: lineHeight
        };

        // Add highlight background if enabled
        if (cfg.labels.highlightOpacity > 0) {
            const highlightX = anchor === 'end'
                ? labelX - estimatedWidth - pad.outer
                : anchor === 'start'
                ? labelX - pad.inner
                : labelX - estimatedWidth / 2 - pad.inner;

            node.label.highlight = {
                x: highlightX,
                y: textBlockTop - pad.top,
                width: estimatedWidth + pad.inner + pad.outer,
                height: estimatedHeight + pad.top + pad.bot,
                rx: fontSize / 4
            };
        }
    }
}

function formatValue(value: number, format: ResolvedSankeyConfig['valueFormat']): string {
    const formatted = value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: format.decimalPlaces
    });
    return `${format.prefix}${formatted}${format.suffix}`;
}
