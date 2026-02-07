/**
 * SankeyDiagram React Component
 *
 * A reusable React component for rendering Sankey diagrams.
 * Matches SankeyMATIC's visual style and behavior.
 */

import { useRef, useState, useMemo, useCallback, useLayoutEffect } from 'react';
import { computeSankeyLayout } from './layout';
import { generateFlowPaths, generateNodeRects, generateLabels, getLabelHighlightColor, formatTooltipValue } from './renderer';
import type { FlowPath, NodeRect } from './renderer';

import type { SankeyFlow, SankeyConfig } from './types';

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
}: SankeyDiagramProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [ tooltip, setTooltip ] = useState<TooltipState>({ visible: false, x: 0, y: 0, content: null });
    const [ highlightedNode, setHighlightedNode ] = useState<string | null>(null);
    const [ highlightedFlow, setHighlightedFlow ] = useState<number | null>(null);
    const [ containerSize, setContainerSize ] = useState<{ width: number; height: number } | null>(null);

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

        setTooltip({
            visible: true,
            x,
            y,
            content: (
                <div style={{ padding: '8px', maxWidth: 200, color: '#333' }}>
                    <strong>{node.name}</strong>
                    <div style={{ marginTop: 4 }}>{formatTooltipValue(node.value, diagramData.config.valueFormat)}</div>
                </div>
            )
        });
        setHighlightedNode(node.name);
    }, [ diagramData ]);

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
        if (onNodeClick) {
            onNodeClick(node.name, node.value);
        }
    }, [ onNodeClick ]);

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
                                    strokeOpacity={isHighlighted ? Math.min(path.opacity + 0.3, 1) : path.opacity}
                                    style={{
                                        cursor: onFlowClick ? 'pointer' : 'default',
                                        transition: 'stroke-opacity 0.2s ease'
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
                            const isHighlighted = highlightedNode === node.name;

                            return (
                                <g key={`node-${idx}`}>
                                    <rect
                                        x={node.x}
                                        y={node.y}
                                        width={node.width}
                                        height={node.height}
                                        fill={node.color}
                                        fillOpacity={node.opacity}
                                        stroke={node.borderWidth > 0 ? node.borderColor : 'none'}
                                        strokeWidth={node.borderWidth}
                                        style={{
                                            cursor: onNodeClick ? 'pointer' : 'default',
                                            filter: isHighlighted ? 'brightness(1.2)' : 'none',
                                            transition: 'filter 0.2s ease'
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
                    <g className='labels'>
                        {labels.map((label, idx) => {
                            const highlightColor = getLabelHighlightColor(label.nodeColor, label.opacity);

                            return (
                                <g key={`label-${idx}`}>
                                    {/* Highlight background */}
                                    {label.highlight && label.opacity > 0 && (
                                        <rect
                                            x={label.highlight.x}
                                            y={label.highlight.y}
                                            width={label.highlight.width}
                                            height={label.highlight.height}
                                            rx={label.highlight.rx}
                                            fill={highlightColor}
                                            pointerEvents='none'
                                        />
                                    )}
                                    {/* Label text */}
                                    <text
                                        x={label.x}
                                        y={label.y}
                                        textAnchor={label.anchor}
                                        dominantBaseline='central'
                                        style={{
                                            fontFamily: diagramData.config.labels.fontFamily,
                                            pointerEvents: 'none',
                                            userSelect: 'none'
                                        }}
                                    >
                                        {label.pieces.map((piece, pieceIdx) => {
                                            // Calculate dy: first line offsets up to center the block,
                                            // subsequent lines move down by lineHeight
                                            const lineHeight = piece.size * 1.4;
                                            const totalLines = label.pieces.filter(p => p.newLine).length + 1;
                                            const totalHeight = totalLines * lineHeight;

                                            let dyValue: number;
                                            if (pieceIdx === 0) {
                                                // First line: offset up by half the total height, then down by half a line
                                                dyValue = -totalHeight / 2 + lineHeight / 2;
                                            } else if (piece.newLine) {
                                                // New line: move down by line height
                                                dyValue = lineHeight;
                                            } else {
                                                // Same line continuation
                                                dyValue = 0;
                                            }

                                            return (
                                                <tspan
                                                    key={pieceIdx}
                                                    x={piece.newLine || pieceIdx === 0 ? label.x : undefined}
                                                    dy={dyValue}
                                                    fontSize={piece.size}
                                                    fontWeight={piece.weight}
                                                    fill={diagramData.config.labels.color}
                                                >
                                                    {piece.text}
                                                </tspan>
                                            );
                                        })}
                                    </text>
                                </g>
                            );
                        })}
                    </g>
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
