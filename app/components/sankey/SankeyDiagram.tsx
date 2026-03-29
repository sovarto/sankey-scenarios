/**
 * SankeyDiagram React Component
 *
 * A reusable React component for rendering Sankey diagrams.
 * Matches SankeyMATIC's visual style and behavior.
 */

import { useRef, useState, useMemo, useCallback, useLayoutEffect, useEffect } from 'react';
import { computeSankeyLayout } from './layout';
import { generateFlowPaths, generateNodeRects, generateLabels, getLabelHighlightColor, formatTooltipValue } from './renderer';
import type { FlowPath, NodeRect, LabelElement } from './renderer';

import type { SankeyFlow, SankeyConfig } from './types';

/** Bounding box with padding for collision detection */
interface LabelBBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Check if two bounding boxes overlap */
function boxesOverlap(a: LabelBBox, b: LabelBBox, padding = 2): boolean {
    return !(a.x + a.width + padding < b.x
        || b.x + b.width + padding < a.x
        || a.y + a.height + padding < b.y
        || b.y + b.height + padding < a.y);
}

/** Props for the SankeyLabel component */
interface SankeyLabelProps {
    label: LabelElement;
    isHovered: boolean;
    isHidden: boolean;
    useCompact: boolean;
    fontFamily: string;
    labelColor: string;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onClick: () => void;
    onMeasure?: (fullBBox: LabelBBox, compactBBox: LabelBBox) => void;
}

/**
 * Individual label component that measures its own text and renders highlight accordingly
 */
function SankeyLabel(
    { label, isHovered, isHidden, useCompact, fontFamily, labelColor, onMouseEnter, onMouseLeave, onClick, onMeasure }:
        SankeyLabelProps,
) {
    const textRef = useRef<SVGTextElement>(null);
    const measureFullRef = useRef<SVGTextElement>(null);
    const measureCompactRef = useRef<SVGTextElement>(null);
    const [ bbox, setBbox ] = useState<LabelBBox | null>(null);

    // Show full on hover, otherwise respect useCompact
    const showFull = isHovered || !useCompact;
    const displayPieces = showFull ? label.pieces : label.compactPieces;
    const highlightColor = getLabelHighlightColor(label.nodeColor, label.opacity);
    const fontSize = displayPieces[0]?.size ?? 12;
    const padding = { x: fontSize * 0.4, y: fontSize * 0.3 };

    // Measure both full and compact versions for collision detection
    useLayoutEffect(() => {
        if (onMeasure && measureFullRef.current && measureCompactRef.current) {
            const fullBox = measureFullRef.current.getBBox();
            const compactBox = measureCompactRef.current.getBBox();
            const fullPadding = { x: (label.pieces[0]?.size ?? 12) * 0.4, y: (label.pieces[0]?.size ?? 12) * 0.3 };
            const compactPadding = {
                x: (label.compactPieces[0]?.size ?? 12) * 0.4,
                y: (label.compactPieces[0]?.size ?? 12) * 0.3
            };

            onMeasure(
                {
                    x: fullBox.x - fullPadding.x,
                    y: fullBox.y - fullPadding.y,
                    width: fullBox.width + fullPadding.x * 2,
                    height: fullBox.height + fullPadding.y * 2
                },
                {
                    x: compactBox.x - compactPadding.x,
                    y: compactBox.y - compactPadding.y,
                    width: compactBox.width + compactPadding.x * 2,
                    height: compactBox.height + compactPadding.y * 2
                }
            );
        }
    }, [ label.x, label.y, onMeasure ]);

    // Measure visible text for highlight
    useLayoutEffect(() => {
        if (textRef.current) {
            const box = textRef.current.getBBox();
            setBbox({ x: box.x, y: box.y, width: box.width, height: box.height });
        }
    }, [ displayPieces, isHovered, useCompact ]);

    // Helper to render text content
    const renderTextContent = (pieces: typeof displayPieces, ref?: React.RefObject<SVGTextElement | null>) => {
        const lineHeight = (pieces[0]?.size ?? 12) * 1.4;
        const totalLines = pieces.filter(p => p.newLine).length + 1;
        const totalHeight = totalLines * lineHeight;

        return (
            <text
                ref={ref}
                x={label.x}
                y={label.y}
                textAnchor={label.anchor}
                dominantBaseline='central'
                style={{
                    fontFamily,
                    userSelect: 'none'
                }}
            >
                {pieces.map((piece, pieceIdx) => {
                    let dyValue: number;
                    if (pieceIdx === 0) {
                        dyValue = -totalHeight / 2 + lineHeight / 2;
                    } else if (piece.newLine) {
                        dyValue = lineHeight;
                    } else {
                        dyValue = 0;
                    }

                    return (
                        <tspan
                            key={pieceIdx}
                            x={piece.newLine || pieceIdx === 0 ? label.x : undefined}
                            dy={dyValue}
                            fontSize={piece.size}
                            fontWeight={piece.weight}
                            fill={labelColor}
                        >
                            {piece.text}
                        </tspan>
                    );
                })}
            </text>
        );
    };

    return (
        <g
            style={{
                opacity: isHidden ? 0 : 1,
                transition: 'opacity 0.2s ease',
                cursor: 'pointer'
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
        >
            {/* Hidden measurement texts */}
            {onMeasure && (
                <g style={{ visibility: 'hidden', pointerEvents: 'none' }}>
                    {renderTextContent(label.pieces, measureFullRef)}
                    {renderTextContent(label.compactPieces, measureCompactRef)}
                </g>
            )}

            {/* Highlight background - rendered based on measured text bbox */}
            {bbox && label.opacity > 0 && (
                <rect
                    x={bbox.x - padding.x}
                    y={bbox.y - padding.y}
                    width={bbox.width + padding.x * 2}
                    height={bbox.height + padding.y * 2}
                    rx={fontSize / 4}
                    fill={isHovered
                        ? getLabelHighlightColor(label.nodeColor, Math.min(label.opacity + 0.3, 1))
                        : highlightColor}
                />
            )}
            {/* Visible label text */}
            {renderTextContent(displayPieces, textRef)}
        </g>
    );
}

/** Props for SankeyLabels wrapper component */
interface SankeyLabelsProps {
    labels: LabelElement[];
    hiddenNodes: Set<string>;
    hoveredLabel: number | null;
    fontFamily: string;
    labelColor: string;
    onHoverLabel: (idx: number | null) => void;
    onClickLabel: (nodeName: string) => void;
    /** Callback when collisions are detected, reports number of compact labels and suggested height increase */
    onCollisionInfo?: (info: { compactCount: number; suggestedHeightIncrease: number }) => void;
}

/**
 * Wrapper component that handles label collision detection
 */
function SankeyLabels(
    { labels, hiddenNodes, hoveredLabel, fontFamily, labelColor, onHoverLabel, onClickLabel, onCollisionInfo }:
        SankeyLabelsProps,
) {
    const [ labelBBoxes, setLabelBBoxes ] = useState<Map<number, { full: LabelBBox; compact: LabelBBox }>>(new Map());
    const [ compactLabels, setCompactLabels ] = useState<Set<number>>(new Set());
    const [ measurementComplete, setMeasurementComplete ] = useState(false);

    // Create a stable key from label positions to detect layout changes
    const labelsKey = useMemo(() => labels.map(l => `${l.x.toFixed(1)},${l.y.toFixed(1)}`).join('|'), [ labels ]);

    // Reset measurement state when labels change (positions change due to layout)
    useEffect(() => {
        setLabelBBoxes(new Map());
        setCompactLabels(new Set());
        setMeasurementComplete(false);
    }, [ labelsKey ]);

    // Handle measurement callback from each label
    const handleMeasure = useCallback((idx: number, fullBBox: LabelBBox, compactBBox: LabelBBox) => {
        setLabelBBoxes(prev => {
            const next = new Map(prev);
            next.set(idx, { full: fullBBox, compact: compactBBox });
            return next;
        });
    }, []);

    // Calculate collisions once all labels are measured
    useLayoutEffect(() => {
        if (labelBBoxes.size !== labels.length || labels.length === 0) {
            return;
        }

        // Greedy algorithm: process labels and mark colliding ones as compact
        const needsCompact = new Set<number>();
        const sortedIndices = [ ...labelBBoxes.keys() ].sort((a, b) => {
            // Prioritize keeping labels with higher values as full labels
            const labelA = labels[a];
            const labelB = labels[b];
            // Sort by value descending (higher value = higher priority to stay full)
            return labelB.value - labelA.value;
        });

        // Track which boxes are "placed" as full
        const placedFullBoxes: { idx: number; box: LabelBBox }[] = [];

        for (const idx of sortedIndices) {
            const bboxes = labelBBoxes.get(idx)!;
            const fullBox = bboxes.full;

            // Check if full box collides with any already placed full box
            let collides = false;
            for (const placed of placedFullBoxes) {
                if (boxesOverlap(fullBox, placed.box)) {
                    collides = true;
                    break;
                }
            }

            if (collides) {
                // Try compact box
                const compactBox = bboxes.compact;
                let compactCollides = false;
                for (const placed of placedFullBoxes) {
                    if (boxesOverlap(compactBox, placed.box)) {
                        compactCollides = true;
                        break;
                    }
                }

                if (compactCollides) {
                    // Even compact collides, but we still mark as compact (it's smaller)
                    needsCompact.add(idx);
                    placedFullBoxes.push({ idx, box: compactBox });
                } else {
                    needsCompact.add(idx);
                    placedFullBoxes.push({ idx, box: compactBox });
                }
            } else {
                // No collision, use full
                placedFullBoxes.push({ idx, box: fullBox });
            }
        }

        setCompactLabels(needsCompact);
        setMeasurementComplete(true);

        // Report collision info - use small fixed increment to avoid overshooting
        // The auto-fit will iterate until no collisions remain
        if (onCollisionInfo) {
            onCollisionInfo({
                compactCount: needsCompact.size,
                suggestedHeightIncrease: needsCompact.size > 0 ? 30 : 0
            });
        }
    }, [ labelBBoxes, labels, onCollisionInfo ]);

    // Sort labels so hovered one renders on top
    const sortedLabels = useMemo(() => {
        return [ ...labels ].map((label, idx) => ({ label, idx })).sort((a, b) => {
            if (a.idx === hoveredLabel) {
                return 1;
            }
            if (b.idx === hoveredLabel) {
                return -1;
            }
            return 0;
        });
    }, [ labels, hoveredLabel ]);

    return (
        <g className='labels'>
            {sortedLabels.map(({ label, idx }) => (
                <SankeyLabel
                    key={`label-${idx}`}
                    label={label}
                    isHovered={hoveredLabel === idx}
                    isHidden={hiddenNodes.has(label.nodeName)}
                    useCompact={measurementComplete ? compactLabels.has(idx) : false}
                    fontFamily={fontFamily}
                    labelColor={labelColor}
                    onMouseEnter={() => onHoverLabel(idx)}
                    onMouseLeave={() => onHoverLabel(null)}
                    onClick={() => onClickLabel(label.nodeName)}
                    onMeasure={!measurementComplete
                        ? (full, compact) => handleMeasure(idx, full, compact)
                        : undefined}
                />
            ))}
        </g>
    );
}

export interface SankeyDiagramProps {
    /** Array of flow data describing connections between nodes */
    flows: SankeyFlow[];
    /** Configuration options for the diagram */
    config?: SankeyConfig;
    /** Callback when a flow is clicked */
    onFlowClick?: (flow: SankeyFlow, index: number) => void;
    /** Callback when a node is clicked */
    onNodeClick?: (nodeName: string, value: number) => void;
    /** CSS class name for the container */
    className?: string;
    /** Inline styles for the container */
    style?: React.CSSProperties;
    /** When true, automatically adjusts height to fit all labels without collision */
    autoFitLabels?: boolean;
    /** Callback when auto-fit calculates a new required height */
    onHeightChange?: (height: number) => void;
}

interface TooltipState {
    visible: boolean;
    x: number;
    y: number;
    content: React.ReactNode;
}

/**
 * Sankey Diagram Component
 *
 * Renders a Sankey diagram from flow data with interactive features.
 *
 * @example
 * ```tsx
 * // Auto-sizes to fill container
 * <SankeyDiagram
 *     flows={[
 *         { source: 'A', target: 'B', value: 100 },
 *         { source: 'A', target: 'C', value: 50 },
 *         { source: 'B', target: 'D', value: 80 },
 *     ]}
 *     config={{ flowColorMode: 'source' }}
 * />
 *
 * // Or with explicit dimensions
 * <SankeyDiagram
 *     flows={[...]}
 *     config={{ width: 800, height: 400 }}
 * />
 * ```
 */
export function SankeyDiagram({
    flows,
    config = {},
    onFlowClick,
    onNodeClick,
    className,
    style,
    autoFitLabels,
    onHeightChange,
}: SankeyDiagramProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [ tooltip, setTooltip ] = useState<TooltipState>({ visible: false, x: 0, y: 0, content: null });
    const [ highlightedNode, setHighlightedNode ] = useState<string | null>(null);
    const [ highlightedFlow, setHighlightedFlow ] = useState<number | null>(null);
    const [ containerSize, setContainerSize ] = useState<{ width: number; height: number } | null>(null);
    const [ collapsedNodes, setCollapsedNodes ] = useState<Set<string>>(new Set());
    const [ hoveredLabel, setHoveredLabel ] = useState<number | null>(null);

    // Track auto-fit iterations to prevent infinite render loops
    const autoFitIterations = useRef(0);
    const MAX_AUTO_FIT_ITERATIONS = 20;

    // Reset iteration counter when flows or non-height config changes
    const flowsKey = useMemo(() => flows.map(f => `${f.source}-${f.target}-${f.value}`).join('|'), [ flows ]);
    useEffect(() => {
        autoFitIterations.current = 0;
    }, [ flowsKey, autoFitLabels ]);

    // Handle collision info from labels - used for auto-fit
    const handleCollisionInfo = useCallback((info: { compactCount: number; suggestedHeightIncrease: number }) => {
        if (autoFitLabels && onHeightChange && info.compactCount > 0 && info.suggestedHeightIncrease > 0) {
            if (autoFitIterations.current >= MAX_AUTO_FIT_ITERATIONS) {
                return; // Stop iterating to prevent infinite loop
            }
            autoFitIterations.current++;
            const currentHeight = config.height || containerSize?.height || 400;
            const increase = autoFitIterations.current > 10 ? 50 : info.suggestedHeightIncrease;
            const newHeight = Math.min(2000, currentHeight + increase);
            if (newHeight > currentHeight) {
                onHeightChange(newHeight);
            }
        }
    }, [ autoFitLabels, onHeightChange, config.height, containerSize?.height ]);

    // Measure container size when no explicit dimensions provided
    useLayoutEffect(() => {
        if (config.width && config.height) {
            // Explicit dimensions provided, no need to measure
            setContainerSize(null);
            return;
        }

        const container = containerRef.current;
        if (!container) {
            return;
        }

        const updateSize = () => {
            const rect = container.getBoundingClientRect();
            const width = config.width || rect.width || 600;
            const height = config.height || rect.height || 400;
            setContainerSize({ width, height });
        };

        // Initial measurement
        updateSize();

        // Set up ResizeObserver for dynamic resizing
        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(container);

        return () => resizeObserver.disconnect();
    }, [ config.width, config.height ]);

    // Compute effective config with measured dimensions
    const effectiveConfig = useMemo(() => {
        if (config.width && config.height) {
            return config;
        }
        if (!containerSize) {
            return config;
        }
        return {
            ...config,
            width: config.width || containerSize.width,
            height: config.height || containerSize.height
        };
    }, [ config, containerSize ]);

    // Compute the layout
    const diagramData = useMemo(() => {
        if (!flows || flows.length === 0) {
            return null;
        }
        // Wait for container measurement if no explicit dimensions
        if (!config.width && !config.height && !containerSize) {
            return null;
        }
        return computeSankeyLayout(flows, effectiveConfig);
    }, [ flows, effectiveConfig, config.width, config.height, containerSize ]);

    // Generate rendering elements
    const flowPaths = useMemo(() => diagramData ? generateFlowPaths(diagramData) : [], [ diagramData ]);
    const nodeRects = useMemo(() => diagramData ? generateNodeRects(diagramData) : [], [ diagramData ]);
    const labels = useMemo(() => diagramData ? generateLabels(diagramData) : [], [ diagramData ]);

    // Compute which nodes are hidden (only if ALL incoming flows are from hidden/collapsed nodes)
    const hiddenNodes = useMemo(() => {
        if (collapsedNodes.size === 0 || flowPaths.length === 0) {
            return new Set<string>();
        }

        // Build incoming edges map: for each node, which nodes flow into it
        const incomingFrom = new Map<string, Set<string>>();
        for (const path of flowPaths) {
            const source = path.flow.source.name;
            const target = path.flow.target.name;
            if (!incomingFrom.has(target)) {
                incomingFrom.set(target, new Set());
            }
            incomingFrom.get(target)!.add(source);
        }

        const hidden = new Set<string>();
        let changed = true;

        // Iteratively find nodes where ALL incoming flows are from collapsed or hidden nodes
        while (changed) {
            changed = false;
            for (const [ node, sources ] of incomingFrom) {
                if (hidden.has(node) || collapsedNodes.has(node)) {
                    continue;
                }

                // Check if ALL sources are either collapsed or hidden
                const allSourcesBlocked = [ ...sources ].every(
                    source => collapsedNodes.has(source) || hidden.has(source)
                );

                if (allSourcesBlocked) {
                    hidden.add(node);
                    changed = true;
                }
            }
        }

        return hidden;
    }, [ collapsedNodes, flowPaths ]);

    // Handle mouse events
    const handleFlowMouseEnter = useCallback((e: React.MouseEvent, path: FlowPath) => {
        const flow = path.flow;
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect || !diagramData) {
            return;
        }

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setTooltip({
            visible: true,
            x,
            y,
            content: (
                <div style={{ padding: '8px', maxWidth: 200, color: '#333' }}>
                    <strong>{flow.source.tipName}</strong>
                    <span style={{ margin: '0 4px' }}>→</span>
                    <strong>{flow.target.tipName}</strong>
                    <div style={{ marginTop: 4 }}>{formatTooltipValue(flow.value, diagramData.config.valueFormat)}</div>
                </div>
            )
        });
        setHighlightedFlow(flow.index);
    }, [ diagramData ]);

    const handleNodeMouseEnter = useCallback((e: React.MouseEvent, node: NodeRect) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect || !diagramData) {
            return;
        }

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const isCollapsed = collapsedNodes.has(node.internalName);

        setTooltip({
            visible: true,
            x,
            y,
            content: (
                <div style={{ padding: '8px', maxWidth: 200, color: '#333' }}>
                    <strong>{node.name}</strong>
                    <div style={{ marginTop: 4 }}>{formatTooltipValue(node.value, diagramData.config.valueFormat)}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: '#666', fontStyle: 'italic' }}>
                        {isCollapsed ? 'Click to show outgoing flows' : 'Click to hide outgoing flows'}
                    </div>
                </div>
            )
        });
        setHighlightedNode(node.internalName);
    }, [ diagramData, collapsedNodes ]);

    const handleMouseLeave = useCallback(() => {
        setTooltip(prev => ({ ...prev, visible: false }));
        setHighlightedFlow(null);
        setHighlightedNode(null);
    }, []);

    const handleFlowClick = useCallback((path: FlowPath) => {
        if (onFlowClick) {
            const originalFlow = flows.find(
                f => f.source === path.flow.source.name
                    && f.target === path.flow.target.name
                    && f.value === path.flow.value
            );
            if (originalFlow) {
                onFlowClick(originalFlow, flows.indexOf(originalFlow));
            }
        }
    }, [ flows, onFlowClick ]);

    const handleNodeClick = useCallback((node: NodeRect) => {
        // Toggle collapsed state for this node
        setCollapsedNodes(prev => {
            const next = new Set(prev);
            if (next.has(node.internalName)) {
                next.delete(node.internalName);
            } else {
                next.add(node.internalName);
            }
            return next;
        });

        if (onNodeClick) {
            onNodeClick(node.name, node.value);
        }
    }, [ onNodeClick ]);

    const handleLabelClick = useCallback((nodeName: string) => {
        // Toggle collapsed state for the node associated with this label
        setCollapsedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeName)) {
                next.delete(nodeName);
            } else {
                next.add(nodeName);
            }
            return next;
        });

        // Also trigger onNodeClick if provided
        if (onNodeClick) {
            const node = nodeRects.find(n => n.internalName === nodeName);
            if (node) {
                onNodeClick(node.name, node.value);
            }
        }
    }, [ onNodeClick, nodeRects ]);

    if (!diagramData) {
        return (
            <div
                ref={containerRef}
                className={className}
                style={{
                    ...style,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: config.width || '100%',
                    height: config.height || '100%',
                    minHeight: config.height || 200
                }}
            >
                {flows && flows.length > 0
                    ? <span style={{ color: '#666' }}>Measuring...</span>
                    : <span style={{ color: '#666' }}>No data to display</span>}
            </div>
        );
    }

    const { width, height, margin } = diagramData;

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                position: 'relative',
                width: config.width || '100%',
                height: config.height || '100%',
                ...style
            }}
        >
            <svg ref={svgRef} width={width} height={height} style={{ display: 'block' }}>
                {/* Background */}
                <rect width={width} height={height} fill={diagramData.config.backgroundColor} />

                {/* Main content group with margin */}
                <g transform={`translate(${margin.left}, ${margin.top})`}>
                    {/* Flows */}
                    <g className='flows'>
                        {flowPaths.map((path) => {
                            const sourceIsCollapsed = collapsedNodes.has(path.flow.source.name);
                            const sourceIsHidden = hiddenNodes.has(path.flow.source.name);
                            const isHidden = sourceIsCollapsed || sourceIsHidden;
                            const isHighlighted = highlightedFlow === path.flow.index
                                || highlightedNode === path.flow.source.name
                                || highlightedNode === path.flow.target.name;

                            return (
                                <path
                                    key={`flow-${path.flow.index}`}
                                    d={path.d}
                                    fill='none'
                                    stroke={path.color}
                                    strokeWidth={path.strokeWidth}
                                    strokeOpacity={isHidden
                                        ? 0
                                        : (isHighlighted ? Math.min(path.opacity + 0.3, 1) : path.opacity)}
                                    style={{
                                        cursor: onFlowClick ? 'pointer' : 'default',
                                        transition: 'stroke-opacity 0.2s ease',
                                        pointerEvents: isHidden ? 'none' : 'auto'
                                    }}
                                    onMouseEnter={(e) => handleFlowMouseEnter(e, path)}
                                    onMouseLeave={handleMouseLeave}
                                    onClick={() => handleFlowClick(path)}
                                />
                            );
                        })}
                    </g>

                    {/* Nodes */}
                    <g className='nodes'>
                        {nodeRects.map((node, idx) => {
                            const isHighlighted = highlightedNode === node.internalName;
                            const isCollapsed = collapsedNodes.has(node.internalName);
                            const isHidden = hiddenNodes.has(node.internalName);

                            return (
                                <g key={`node-${idx}`}>
                                    <rect
                                        x={node.x}
                                        y={node.y}
                                        width={node.width}
                                        height={node.height}
                                        fill={node.color}
                                        fillOpacity={isHidden ? 0 : (isCollapsed ? node.opacity * 0.6 : node.opacity)}
                                        stroke={isHidden
                                            ? 'none'
                                            : (isCollapsed
                                                ? '#333'
                                                : (node.borderWidth > 0 ? node.borderColor : 'none'))}
                                        strokeWidth={isCollapsed ? 2 : node.borderWidth}
                                        strokeDasharray={isCollapsed ? '4 2' : 'none'}
                                        style={{
                                            cursor: isHidden ? 'default' : 'pointer',
                                            filter: isHighlighted && !isHidden ? 'brightness(1.2)' : 'none',
                                            transition: 'filter 0.2s ease, fill-opacity 0.2s ease',
                                            pointerEvents: isHidden ? 'none' : 'auto'
                                        }}
                                        onMouseEnter={(e) => handleNodeMouseEnter(e, node)}
                                        onMouseLeave={handleMouseLeave}
                                        onClick={() => handleNodeClick(node)}
                                    />
                                </g>
                            );
                        })}
                    </g>

                    {/* Labels */}
                    <SankeyLabels
                        labels={labels}
                        hiddenNodes={hiddenNodes}
                        hoveredLabel={hoveredLabel}
                        fontFamily={diagramData.config.labels.fontFamily}
                        labelColor={diagramData.config.labels.color}
                        onHoverLabel={setHoveredLabel}
                        onClickLabel={handleLabelClick}
                        onCollisionInfo={autoFitLabels ? handleCollisionInfo : undefined}
                    />
                </g>
            </svg>

            {/* Tooltip */}
            {tooltip.visible && (
                <div
                    style={{
                        position: 'absolute',
                        left: tooltip.x + 10,
                        top: tooltip.y + 10,
                        background: 'white',
                        border: '1px solid #ccc',
                        borderRadius: 4,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        pointerEvents: 'none',
                        zIndex: 1000,
                        fontSize: 14,
                        fontFamily: 'sans-serif'
                    }}
                >
                    {tooltip.content}
                </div>
            )}
        </div>
    );
}
