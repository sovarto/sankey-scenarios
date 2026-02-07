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
    // For references
    refName?: string;
    refId?: number;
    direction?: 'source' | 'target';
    connectingLocalNodeId?: number;
}

export type ComboboxOption = {
    type: 'node' | 'group' | 'local';
    id?: number;
    name: string;
    value?: number;
    display: string;
};
