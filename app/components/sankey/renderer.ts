/**
 * Sankey Renderer
 *
 * Creates SVG path strings for flows, closely matching SankeyMATIC's rendering.
 */

import * as d3 from 'd3';
import type { InternalFlow, SankeyDiagramData } from './types';

export interface FlowPath {
    d: string;
    color: string;
    opacity: number;
    strokeWidth: number;
    flow: InternalFlow;
}

export interface NodeRect {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    opacity: number;
    borderColor?: string;
    borderWidth: number;
    name: string;
    /** Internal node identifier used for flow matching */
    internalName: string;
    value: number;
}

export interface LabelElement {
    anchor: 'start' | 'end' | 'middle';
    x: number;
    y: number;
    dy: number;
    pieces: Array<{
        text: string;
        size: number;
        weight: string | number;
        newLine?: boolean;
        isValue?: boolean;
    }>;
    /** Compact label pieces (name only, no value) */
    compactPieces: Array<{
        text: string;
        size: number;
        weight: string | number;
        newLine?: boolean;
    }>;
    opacity: number;
    nodeColor: string;
    nodeName: string;
    /** Node value for collision priority (higher value = higher priority to stay full) */
    value: number;
}

/**
 * Generate SVG path data for flows using cubic Bezier curves
 * Matches SankeyMATIC's flow rendering approach
 */
export function generateFlowPaths(data: SankeyDiagramData): FlowPath[] {
    const curvature = data.config.flowCurvature;
    const paths: FlowPath[] = [];

    for (const flow of data.flows) {
        if (flow.isAShadow && !flow.useForVisiblePlacing) {
            continue;
        }

        // Calculate flow path endpoints
        const sourceX = flow.source.x + flow.source.dx;
        const targetX = flow.target.x;
        const sourceY = flow.source.y + flow.sy + flow.dy / 2;
        const targetY = flow.target.y + flow.ty + flow.dy / 2;

        // Calculate control point offset based on curvature
        const xi = d3.interpolateNumber(sourceX, targetX);
        const x2 = xi(curvature);
        const x3 = xi(1 - curvature);

        // Create path
        const d = `M${sourceX},${sourceY}C${x2},${sourceY} ${x3},${targetY} ${targetX},${targetY}`;

        paths.push({
            d,
            color: flow.color || '#999',
            opacity: flow.opacity ?? data.config.flowOpacity,
            strokeWidth: Math.max(1, flow.dy),
            flow
        });
    }

    return paths;
}

/**
 * Generate node rectangles for rendering
 */
export function generateNodeRects(data: SankeyDiagramData): NodeRect[] {
    return data.nodes.map(node => ({
        x: node.x,
        y: node.y,
        width: node.dx,
        height: Math.max(node.dy, 1),
        color: node.color,
        opacity: node.opacity ?? data.config.nodeOpacity,
        borderColor: node.borderColor,
        borderWidth: data.config.nodeBorder,
        name: node.tipName || node.name,
        internalName: node.name,
        value: node.value
    }));
}

/**
 * Generate label elements for rendering
 */
export function generateLabels(data: SankeyDiagramData): LabelElement[] {
    if (!data.config.labels.show) {
        return [];
    }

    const labels: LabelElement[] = [];

    for (const node of data.nodes) {
        if (node.hideLabel || !node.label) {
            continue;
        }

        labels.push({
            anchor: node.label.anchor,
            x: node.label.x,
            y: node.label.y,
            dy: node.label.dy,
            pieces: node.label.pieces,
            compactPieces: node.label.compactPieces,
            opacity: data.config.labels.highlightOpacity,
            nodeColor: node.color,
            nodeName: node.name,
            value: node.value
        });
    }

    return labels;
}

/**
 * Get the highlight color for a label based on node color
 * SankeyMATIC uses a light colored rectangle behind labels
 */
export function getLabelHighlightColor(nodeColor: string, opacity: number): string {
    const rgb = d3.rgb(nodeColor);
    // Blend toward white for the highlight
    const r = Math.round(rgb.r + (255 - rgb.r) * 0.7);
    const g = Math.round(rgb.g + (255 - rgb.g) * 0.7);
    const b = Math.round(rgb.b + (255 - rgb.b) * 0.7);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Generate gradient definitions for flows (optional, for more advanced styling)
 */
export function generateFlowGradients(data: SankeyDiagramData): Array<{
    id: string;
    sourceColor: string;
    targetColor: string;
}> {
    const gradients: Array<{
        id: string;
        sourceColor: string;
        targetColor: string;
    }> = [];

    // Only generate gradients if flows have different source/target colors
    for (const flow of data.flows) {
        if (flow.source.color !== flow.target.color && data.config.flowColorMode !== 'none') {
            const id = `flow-gradient-${flow.index}`;
            gradients.push({
                id,
                sourceColor: flow.source.color,
                targetColor: flow.target.color
            });
        }
    }

    return gradients;
}

/**
 * Calculate tooltip position for a flow
 */
export function getFlowTooltipPosition(flow: InternalFlow): { x: number; y: number } {
    const sourceX = flow.source.x + flow.source.dx;
    const targetX = flow.target.x;
    const sourceY = flow.source.y + flow.sy + flow.dy / 2;
    const targetY = flow.target.y + flow.ty + flow.dy / 2;

    return {
        x: (sourceX + targetX) / 2,
        y: (sourceY + targetY) / 2
    };
}

/**
 * Calculate tooltip position for a node
 */
export function getNodeTooltipPosition(node: NodeRect): { x: number; y: number } {
    return {
        x: node.x + node.width / 2,
        y: node.y + node.height / 2
    };
}

/**
 * Format a value for display in tooltips
 */
export function formatTooltipValue(
    value: number,
    format: { prefix: string; suffix: string; decimalPlaces: number },
): string {
    const formatted = value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: format.decimalPlaces
    });
    return `${format.prefix}${formatted}${format.suffix}`;
}
