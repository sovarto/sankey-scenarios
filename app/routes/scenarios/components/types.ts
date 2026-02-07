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
    // For direct connections - placeholder type
    placeholderType?: 'missing' | 'remaining' | null;
    // For direct connections - auto value (value = total incoming to source node)
    autoValue?: boolean;
    // For references
    refName?: string;
    refId?: number;
    direction?: 'source' | 'target';
    connectingLocalNodeId?: number;
    // For group references
    showGroupNode?: boolean;
}

export type ComboboxOption = {
    type: 'node' | 'group' | 'local';
    id?: number;
    name: string;
    value?: number;
    display: string;
};
