export type ConnectionRowType = 'direct' | 'node-ref' | 'group-ref';

export interface ConnectionRowData {
    type: ConnectionRowType;
    id: number;
    source: string;
    target: string;
    sourceLocalNodeId?: number;
    targetLocalNodeId?: number;
    value: number;
    displayOrder: number;
    // For direct connections and group-refs with subNode - placeholder type
    placeholderType?: 'missing' | 'remaining' | null;
    // For direct connections and group-refs with subNode - auto value (value = total incoming to source node)
    autoValue?: boolean;
    // For references
    refName?: string;
    refId?: number;
    direction?: 'source' | 'target';
    connectingLocalNodeId?: number;
    // For group references
    showGroupNode?: boolean;
    // For group references - specific sub-node within the group
    subNode?: string | null;
    // For group references with subNode - custom value (null means use group's calculated value)
    subNodeValue?: number | null;
}

export type ComboboxOption = {
    type: 'node' | 'group' | 'local';
    id?: number;
    name: string;
    value?: number;
    display: string;
    // For groups - the specific sub-node being selected (when not connecting to all)
    subNode?: string;
};

// Group with connections (items) for sub-node selection
export interface GroupWithConnections {
    id: number;
    name: string;
    connections: Array<{ source: string | null; target: string | null; value: number }>;
}
