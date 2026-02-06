/**
 * Sankey Diagram Module
 *
 * A reusable TypeScript module for rendering Sankey diagrams in React.
 * Closely follows SankeyMATIC's visual style and layout algorithms.
 *
 * @example
 * ```tsx
 * import { SankeyDiagram, computeSankeyLayout, DEFAULT_CONFIG } from '~/components/sankey';
 *
 * // Using the React component
 * <SankeyDiagram
 *     flows={[
 *         { source: 'Energy', target: 'Electricity', value: 100 },
 *         { source: 'Electricity', target: 'Residential', value: 40 },
 *         { source: 'Electricity', target: 'Industrial', value: 60 },
 *     ]}
 *     config={{
 *         width: 900,
 *         height: 500,
 *         flowColorMode: 'source',
 *     }}
 *     onNodeClick={(name, value) => console.log(`Clicked ${name}: ${value}`)}
 * />
 *
 * // Or using the layout function directly
 * const layout = computeSankeyLayout(flows, config);
 * // layout contains nodes, flows, dimensions, etc.
 * ```
 */

// Re-export types
export type {
    SankeyFlow,
    SankeyConfig,
    SankeyMargin,
    InternalNode,
    InternalFlow,
    LabelPiece,
    NodeLabel,
    SankeyDiagramData,
    ResolvedSankeyConfig,
} from './types';

// Re-export constants
export { DEFAULT_CONFIG, FONT_METRICS, HIGHLIGHT_STYLES, IN, OUT, BEFORE, AFTER } from './types';

// Re-export layout functions
export { computeSankeyLayout } from './layout';

// Re-export renderer functions
export {
    generateFlowPaths,
    generateNodeRects,
    generateLabels,
    getLabelHighlightColor,
    generateFlowGradients,
    getFlowTooltipPosition,
    getNodeTooltipPosition,
    formatTooltipValue,
    type FlowPath,
    type NodeRect,
    type LabelElement,
} from './renderer';

// Re-export React component
export { SankeyDiagram, type SankeyDiagramProps } from './SankeyDiagram';
