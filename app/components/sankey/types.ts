/**
 * Types for Sankey diagram rendering
 * Based on SankeyMATIC (https://sankeymatic.com)
 */

export interface SankeyFlow {
    source: string;
    target: string;
    value: number;
    color?: string;
    opacity?: number;
    /** Custom display label for source node (if different from source identifier) */
    sourceDisplayName?: string;
    /** Custom display label for target node (if different from target identifier) */
    targetDisplayName?: string;
    /** Explicit color for source node */
    sourceNodeColor?: string;
    /** Explicit color for target node */
    targetNodeColor?: string;
}

export interface SankeyNodeConfig {
    name: string;
    color?: string;
    opacity?: number;
    /** Custom display label (defaults to name) */
    label?: string;
}

export interface SankeyConfig {
    /** Width of the diagram in pixels */
    width?: number;
    /** Height of the diagram in pixels */
    height?: number;
    /** Width of each node bar in pixels */
    nodeWidth?: number;
    /** Node height factor (0-100%), lower = more padding between nodes */
    nodeHeightFactor?: number;
    /** Node spacing factor (0-100%), affects spacing between nodes */
    nodeSpacingFactor?: number;
    /** Node border width (0 = no border) */
    nodeBorder?: number;
    /** Flow curvature (0 = straight lines, 1 = maximum curve) */
    flowCurvature?: number;
    /** Default node color */
    defaultNodeColor?: string;
    /** Default flow color */
    defaultFlowColor?: string;
    /** Default node opacity (0-1) */
    nodeOpacity?: number;
    /** Default flow opacity (0-1) */
    flowOpacity?: number;
    /** How flows inherit color: 'source', 'target', 'outside-in', 'none' */
    flowColorMode?: 'source' | 'target' | 'outside-in' | 'none';
    /** Whether to justify end nodes to the right */
    justifyEnds?: boolean;
    /** Whether to justify origin nodes to the left */
    justifyOrigins?: boolean;
    /** Automatic node layout vs input order */
    layoutOrder?: 'automatic' | 'exact';
    /** Where to attach incomplete flows: 'leading', 'nearest', 'trailing' */
    attachIncompletesTo?: 'leading' | 'nearest' | 'trailing';
    /** Number of layout iterations (higher = better but slower) */
    iterations?: number;
    /** Margin settings */
    margin?: {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
    };
    /** Label configuration */
    labels?: {
        show?: boolean;
        fontSize?: number;
        fontFamily?: 'sans-serif' | 'serif' | 'monospace';
        fontWeight?: number;
        color?: string;
        showValues?: boolean;
        /** Value position relative to name: 'above', 'below', 'before', 'after' */
        valuePosition?: 'above' | 'below' | 'before' | 'after';
        /** Label highlight opacity (0 = no highlight, 1 = solid background) */
        highlightOpacity?: number;
        /** Line spacing multiplier for multi-line labels */
        lineSpacing?: number;
    };
    /** Color scheme for auto-coloring nodes */
    colorScheme?: 'category10' | 'tableau10' | 'dark2' | 'set3' | string[];
    /** Offset for color scheme rotation */
    colorSchemeOffset?: number;
    /** Value formatting */
    valueFormat?: {
        prefix?: string;
        suffix?: string;
        decimalPlaces?: number;
    };
    /** Background color for the diagram */
    backgroundColor?: string;
}

// Direction constants matching SankeyMATIC
export const IN = 'in' as const;
export const OUT = 'out' as const;
export const BEFORE = 'before' as const;
export const AFTER = 'after' as const;

export type Direction = typeof IN | typeof OUT;
export type PaintDirection = typeof BEFORE | typeof AFTER;

// Internal types used by the layout engine
export interface InternalNode {
    index: number;
    name: string;
    displayName: string;
    tipName: string;
    stage: number;
    value: number;
    color: string;
    opacity: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
    sourceRow: number;
    flows: {
        [IN]: InternalFlow[];
        [OUT]: InternalFlow[];
    };
    total: {
        [IN]: number;
        [OUT]: number;
    };
    paint: {
        [BEFORE]: boolean;
        [AFTER]: boolean;
    };
    borderColor?: string;
    isAShadow?: boolean;
    origPos?: { x: number; y: number };
    lastPos?: { x: number; y: number };
    move?: [number, number];
    // Label rendering info
    label?: NodeLabel;
    hideLabel?: boolean;
}

export interface LabelPiece {
    text: string;
    size: number;
    weight: number | string;
    newLine?: boolean;
}

export interface SankeyMargin {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface NodeLabel {
    anchor: 'start' | 'end' | 'middle';
    x: number;
    y: number;
    dy: number;
    pieces: LabelPiece[];
    width: number;
    height: number;
    line1Height: number;
    highlight?: {
        x: number;
        y: number;
        width: number;
        height: number;
        rx: number;
    };
}

export interface InternalFlow {
    index: number;
    source: InternalNode;
    target: InternalNode;
    value: number;
    color: string;
    opacity: number;
    dy: number;
    sy: number;
    ty: number;
    dx: number;
    ds: number;
    renderAs?: 'flat' | 'curved';
    isAShadow?: boolean;
    shadowOf?: number;
    hasAShadow?: boolean;
    sourceRow: number;
    useForVisiblePlacing?: boolean;
    weightedValue?: number;
    hovering?: boolean;
}

export interface SankeyDiagramData {
    nodes: InternalNode[];
    flows: InternalFlow[];
    width: number;
    height: number;
    graphWidth: number;
    graphHeight: number;
    margin: SankeyMargin;
    config: ResolvedSankeyConfig;
}

// Fully resolved config with all required fields
export type ResolvedSankeyConfig = {
    width: number;
    height: number;
    nodeWidth: number;
    nodeHeightFactor: number;
    nodeSpacingFactor: number;
    nodeBorder: number;
    flowCurvature: number;
    defaultNodeColor: string;
    defaultFlowColor: string;
    nodeOpacity: number;
    flowOpacity: number;
    flowColorMode: 'source' | 'target' | 'outside-in' | 'none';
    justifyEnds: boolean;
    justifyOrigins: boolean;
    layoutOrder: 'automatic' | 'exact';
    attachIncompletesTo: 'leading' | 'nearest' | 'trailing';
    iterations: number;
    margin: SankeyMargin;
    labels: {
        show: boolean;
        fontSize: number;
        fontFamily: 'sans-serif' | 'serif' | 'monospace';
        fontWeight: number;
        color: string;
        showValues: boolean;
        valuePosition: 'above' | 'below' | 'before' | 'after';
        highlightOpacity: number;
        lineSpacing: number;
    };
    colorScheme: 'category10' | 'tableau10' | 'dark2' | 'set3' | string[];
    colorSchemeOffset: number;
    valueFormat: {
        prefix: string;
        suffix: string;
        decimalPlaces: number;
    };
    backgroundColor: string;
};

// Default configuration matching SankeyMATIC defaults
export const DEFAULT_CONFIG: ResolvedSankeyConfig = {
    width: 600,
    height: 600,
    nodeWidth: 9,
    nodeHeightFactor: 50,
    nodeSpacingFactor: 85,
    nodeBorder: 0,
    flowCurvature: 0.5,
    defaultNodeColor: '#888888',
    defaultFlowColor: '#999999',
    nodeOpacity: 1.0,
    flowOpacity: 0.45,
    flowColorMode: 'none',
    justifyEnds: false,
    justifyOrigins: false,
    layoutOrder: 'automatic',
    attachIncompletesTo: 'nearest',
    iterations: 25,
    margin: { top: 18, right: 12, bottom: 20, left: 12 },
    labels: {
        show: true,
        fontSize: 16,
        fontFamily: 'sans-serif',
        fontWeight: 400,
        color: '#000000',
        showValues: true,
        valuePosition: 'below',
        highlightOpacity: 0.75,
        lineSpacing: 0.15
    },
    colorScheme: 'category10',
    colorSchemeOffset: 0,
    valueFormat: {
        prefix: '',
        suffix: '',
        decimalPlaces: 2
    },
    backgroundColor: '#ffffff'
};

// Font metrics for label positioning (from SankeyMATIC)
export const FONT_METRICS: Record<string, {
    dy: number;
    top: number;
    bot: number;
    inner: number;
    outer: number;
    marginRight: number;
    marginAdjLeft: number;
}> = {
    'sans-serif': {
        dy: 0.29,
        top: 0.3,
        bot: 0.3,
        inner: 0.35,
        outer: 0.38,
        marginRight: 1.35,
        marginAdjLeft: 0
    },
    serif: {
        dy: 0.29,
        top: 0.3,
        bot: 0.3,
        inner: 0.35,
        outer: 0.38,
        marginRight: 1.35,
        marginAdjLeft: 0
    },
    monospace: {
        dy: 0.28,
        top: 0.3,
        bot: 0.3,
        inner: 0.35,
        outer: 0.38,
        marginRight: 1.45,
        marginAdjLeft: 0
    }
};

// Highlight styles for labels
export const HIGHLIGHT_STYLES = {
    dark: {
        orig: { fill: '#ffffff', stroke: 'none', strokeWidth: 0, strokeOpacity: 0 },
        hover: { fill: '#ffffbb', stroke: '#444400', strokeWidth: 1, strokeOpacity: 0.7 }
    },
    light: {
        orig: { fill: '#000000', stroke: 'none', strokeWidth: 0, strokeOpacity: 0 },
        hover: { fill: '#660033', stroke: '#ffffff', strokeWidth: 1.7, strokeOpacity: 0.9 }
    }
};
