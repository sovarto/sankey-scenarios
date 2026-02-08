import { useState, useMemo, useEffect } from 'react';
import { Link, useFetcher } from 'react-router';
import { NodeCombobox } from './NodeCombobox';
import { parseLocaleNumber, formatLocaleNumber } from './numberUtils';
import { ReorderGroupNodesModal } from './ReorderGroupNodesModal';
import type { ComboboxOption, ConnectionRowData, GroupWithConnections, ValueType } from './types';

/** Parse value field to extract numeric value and whether it's a percentage */
function parseEditValue(value: string, locale?: string): { numericValue: number; isPercent: boolean } {
    const trimmed = value.trim().toLowerCase();

    // Check for percentage suffix (%, p, or percent)
    const percentMatch = trimmed.match(/^(.+?)(%|p|percent)$/);
    if (percentMatch) {
        const numPart = percentMatch[1].trim();
        return { numericValue: parseLocaleNumber(numPart, locale), isPercent: true };
    }

    return { numericValue: parseLocaleNumber(value, locale), isPercent: false };
}

interface EditableConnectionRowProps {
    row: ConnectionRowData;
    projectId: number;
    groups: GroupWithConnections[];
    nodes: Array<{ id: number; name: string; value: number }>;
    localNodes: Array<{ id: number; name: string }>;
    onDelete: () => void;
    isDragging?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDragEnd?: () => void;
    existingPlaceholders?: Array<{ nodeName: string; type: 'missing' | 'remaining' | 'auto'; connectionId?: number }>;
    locale?: string | null;
}

export function EditableConnectionRow({
    row,
    projectId,
    groups,
    nodes,
    localNodes,
    onDelete,
    isDragging,
    onDragStart,
    onDragOver,
    onDragEnd,
    existingPlaceholders,
    locale,
}: EditableConnectionRowProps) {
    const [ editingField, setEditingField ] = useState<'source' | 'target' | 'value' | null>(null);
    const [ editSource, setEditSource ] = useState<ComboboxOption | null>(null);
    const [ editTarget, setEditTarget ] = useState<ComboboxOption | null>(null);
    const [ editValue, setEditValue ] = useState('');
    const [ displaySource, setDisplaySource ] = useState(row.source);
    const [ displayTarget, setDisplayTarget ] = useState(row.target);
    const [ displayValue, setDisplayValue ] = useState(row.value);
    const [ valueType, setValueType ] = useState<'absolute' | 'percent'>(row.valueType ?? 'absolute');
    const [ showGroupNode, setShowGroupNode ] = useState(row.showGroupNode ?? false);
    const [ subNode, setSubNode ] = useState(row.subNode ?? null);
    const [ placeholderType, setPlaceholderType ] = useState<'missing' | 'remaining' | null>(
        row.placeholderType ?? null
    );
    const [ autoValue, setAutoValue ] = useState(row.autoValue ?? false);
    const [ showReorderModal, setShowReorderModal ] = useState(false);
    const fetcher = useFetcher();

    // Get sub-node options for a group
    const getGroupSubNodes = (groupId: number): string[] => {
        const group = groups.find(g => g.id === groupId);
        if (!group) {
            return [];
        }
        const subNodeNames = new Set<string>();
        for (const conn of group.connections) {
            if (conn.source) {
                subNodeNames.add(conn.source);
            }
            if (conn.target) {
                subNodeNames.add(conn.target);
            }
        }
        return Array.from(subNodeNames).sort();
    };

    // Get sub-nodes for current group reference
    const groupSubNodes = row.type === 'group-ref' && row.refId ? getGroupSubNodes(row.refId) : [];

    // Sync display values when row changes from server
    useEffect(() => {
        setDisplaySource(row.source);
    }, [ row.source ]);

    useEffect(() => {
        setDisplayTarget(row.target);
    }, [ row.target ]);

    useEffect(() => {
        setDisplayValue(row.value);
    }, [ row.value ]);

    useEffect(() => {
        setShowGroupNode(row.showGroupNode ?? false);
    }, [ row.showGroupNode ]);

    useEffect(() => {
        setSubNode(row.subNode ?? null);
    }, [ row.subNode ]);

    useEffect(() => {
        setPlaceholderType(row.placeholderType ?? null);
    }, [ row.placeholderType ]);

    useEffect(() => {
        setAutoValue(row.autoValue ?? false);
    }, [ row.autoValue ]);

    useEffect(() => {
        setValueType(row.valueType ?? 'absolute');
    }, [ row.valueType ]);

    // Check if another connection from this source already has auto/remaining
    // (excluding the current connection)
    const sourceHasOtherAutoOrRemaining = useMemo(() => {
        // Works for direct connections and group-refs with subNode
        if (!existingPlaceholders || (row.type !== 'direct' && !(row.type === 'group-ref' && subNode))) {
            return { auto: false, remaining: false };
        }

        // For group-ref with subNode, the source depends on direction
        // If direction is 'target', the subNode is the source
        // If direction is 'source', the connecting local node is the source
        let source: string;
        if (row.type === 'group-ref' && subNode) {
            source = row.direction === 'target' ? subNode : displaySource;
        } else {
            source = displaySource;
        }

        return {
            auto: existingPlaceholders.some(p =>
                p.nodeName === source && p.type === 'auto' && p.connectionId !== row.id
            ),
            remaining: existingPlaceholders.some(p =>
                p.nodeName === source && p.type === 'remaining' && p.connectionId !== row.id
            )
        };
    }, [ existingPlaceholders, displaySource, row.id, row.type, row.direction, subNode ]);

    // Build options list (single entry per group, no sub-nodes in main dropdown)
    const allOptions: ComboboxOption[] = useMemo(() => {
        const opts: ComboboxOption[] = [];

        for (const node of nodes) {
            opts.push({
                type: 'node',
                id: node.id,
                name: node.name,
                value: node.value,
                display: `Node: ${node.name}`
            });
        }

        for (const group of groups) {
            opts.push({
                type: 'group',
                id: group.id,
                name: group.name,
                display: `Group: ${group.name}`
            });
        }

        for (const localNode of localNodes) {
            if (!nodes.some(n => n.name === localNode.name)) {
                opts.push({
                    type: 'local',
                    id: localNode.id,
                    name: localNode.name,
                    display: `Local: ${localNode.name}`
                });
            }
        }

        return opts;
    }, [ nodes, groups, localNodes ]);

    const getBadge = () => {
        if (row.type === 'direct') {
            return <span className='text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded'>Local</span>;
        }
        if (row.type === 'group-ref') {
            return (
                <Link
                    to={`/projects/${projectId}/groups/${row.refId}`}
                    className='text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded hover:bg-green-200'
                >
                    Group
                </Link>
            );
        }
        return (
            <Link
                to={`/projects/${projectId}/nodes/${row.refId}`}
                className='text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded hover:bg-purple-200'
            >
                Node
            </Link>
        );
    };

    // For group-refs with subNode, the subNode acts as the source when direction is 'target'
    const isGroupRefWithSubNodeAsSource = row.type === 'group-ref' && subNode && row.direction === 'target';

    // All sources and targets are now editable
    // Group-refs with subNode can also edit values (like direct connections)
    const canEditValue = row.type === 'direct' || (row.type === 'group-ref' && !!subNode);

    // Start editing source
    const handleSourceClick = () => {
        // For group-refs where the group is the source, use refName directly
        if (row.type === 'group-ref' && row.direction === 'target' && row.refName) {
            const currentOption = allOptions.find(o => o.type === 'group' && o.name === row.refName);
            if (currentOption) {
                setEditSource(currentOption);
                setEditingField('source');
                return;
            }
        }

        // Strip brackets for group names
        const sourceName = displaySource.startsWith('[') && displaySource.endsWith(']')
            ? displaySource.slice(1, -1)
            : displaySource;

        // Find the current option
        const currentOption = allOptions.find(o => o.name === sourceName) || {
            type: 'local' as const,
            name: sourceName,
            display: `Local: ${sourceName}`
        };
        setEditSource(currentOption);
        setEditingField('source');
    };

    // Start editing target
    const handleTargetClick = () => {
        // For group-refs where the group is the target, use refName directly
        if (row.type === 'group-ref' && row.direction === 'source' && row.refName) {
            const currentOption = allOptions.find(o => o.type === 'group' && o.name === row.refName);
            if (currentOption) {
                setEditTarget(currentOption);
                setEditingField('target');
                return;
            }
        }

        // Strip brackets for group names
        const targetName = displayTarget.startsWith('[') && displayTarget.endsWith(']')
            ? displayTarget.slice(1, -1)
            : displayTarget;

        const currentOption = allOptions.find(o => o.name === targetName) || {
            type: 'local' as const,
            name: targetName,
            display: `Local: ${targetName}`
        };
        setEditTarget(currentOption);
        setEditingField('target');
    };

    // Start editing value
    const handleValueClick = () => {
        if (!canEditValue) {
            return;
        }
        // Include percentage suffix in edit value if this is a percent value
        setEditValue(valueType === 'percent' ? `${displayValue}%` : displayValue.toString());
        setEditingField('value');
    };

    // Save source change
    const handleSourceSave = (option: ComboboxOption | null) => {
        if (!option) {
            setEditingField(null);
            return;
        }

        setDisplaySource(option.type === 'group' ? `[${option.name}]` : option.name); // Optimistic update

        // Submit the update
        void fetcher.submit(
            {
                intent: 'update-connection-source',
                connectionType: row.type,
                connectionId: row.id.toString(),
                newSourceType: option.type,
                newSourceName: option.name,
                newSourceRefId: option.id?.toString() ?? '',
                refDirection: row.direction ?? ''
            },
            { method: 'post' }
        );
        setEditingField(null);
    };

    // Save target change
    const handleTargetSave = (option: ComboboxOption | null) => {
        if (!option) {
            setEditingField(null);
            return;
        }

        setDisplayTarget(option.type === 'group' ? `[${option.name}]` : option.name); // Optimistic update

        void fetcher.submit(
            {
                intent: 'update-connection-target',
                connectionType: row.type,
                connectionId: row.id.toString(),
                newTargetType: option.type,
                newTargetName: option.name,
                newTargetRefId: option.id?.toString() ?? '',
                refDirection: row.direction ?? ''
            },
            { method: 'post' }
        );
        setEditingField(null);
    };

    // Save value change
    const handleValueSave = () => {
        const { numericValue, isPercent } = parseEditValue(editValue, locale ?? undefined);
        const newValueType: ValueType = isPercent ? 'percent' : 'absolute';

        if (
            !isNaN(numericValue) && numericValue >= 0 && (numericValue !== displayValue || newValueType !== valueType)
        ) {
            setDisplayValue(numericValue); // Optimistic update
            setValueType(newValueType); // Optimistic update

            // Different intent for group-ref with subNode
            if (row.type === 'group-ref' && subNode) {
                void fetcher.submit(
                    {
                        intent: 'update-group-ref-value',
                        referenceId: row.id.toString(),
                        value: numericValue.toString(),
                        valueType: newValueType
                    },
                    { method: 'post' }
                );
            } else {
                void fetcher.submit(
                    {
                        intent: 'update-connection-value',
                        connectionId: row.id.toString(),
                        value: numericValue.toString(),
                        valueType: newValueType
                    },
                    { method: 'post' }
                );
            }
        }
        setEditingField(null);
    };

    // Toggle showGroupNode
    const handleShowGroupNodeChange = (checked: boolean) => {
        setShowGroupNode(checked); // Optimistic update
        void fetcher.submit(
            {
                intent: 'update-group-ref-show-node',
                referenceId: row.id.toString(),
                showGroupNode: checked ? '1' : '0'
            },
            { method: 'post' }
        );
    };

    // Update subNode for group reference
    const handleSubNodeChange = (value: string) => {
        const newSubNode = value === '' ? null : value;
        setSubNode(newSubNode); // Optimistic update
        if (newSubNode) {
            setShowGroupNode(false); // Clear showGroupNode when setting subNode
        }
        void fetcher.submit(
            {
                intent: 'update-group-ref-sub-node',
                referenceId: row.id.toString(),
                subNode: value
            },
            { method: 'post' }
        );
    };

    // Update placeholder type
    const handlePlaceholderTypeChange = (type: 'missing' | 'remaining' | null) => {
        setPlaceholderType(type); // Optimistic update
        if (type) {
            setAutoValue(false); // Clear autoValue when setting a placeholder type
        }

        // Different intent for group-ref with subNode
        if (row.type === 'group-ref' && subNode) {
            void fetcher.submit(
                {
                    intent: 'update-group-ref-placeholder-type',
                    referenceId: row.id.toString(),
                    placeholderType: type ?? ''
                },
                { method: 'post' }
            );
        } else {
            void fetcher.submit(
                {
                    intent: 'update-connection-placeholder-type',
                    connectionId: row.id.toString(),
                    placeholderType: type ?? ''
                },
                { method: 'post' }
            );
        }
    };

    // Toggle auto value
    const handleAutoValueChange = (checked: boolean) => {
        setAutoValue(checked); // Optimistic update
        if (checked) {
            setPlaceholderType(null); // Clear placeholder when setting auto value
        }

        // Different intent for group-ref with subNode
        if (row.type === 'group-ref' && subNode) {
            void fetcher.submit(
                {
                    intent: 'update-group-ref-auto-value',
                    referenceId: row.id.toString(),
                    autoValue: checked ? '1' : '0'
                },
                { method: 'post' }
            );
        } else {
            void fetcher.submit(
                {
                    intent: 'update-connection-auto-value',
                    connectionId: row.id.toString(),
                    autoValue: checked ? '1' : '0'
                },
                { method: 'post' }
            );
        }
    };

    // Get color class based on what the endpoint actually refers to
    const getColorClassForName = (name: string) => {
        // Strip brackets for group names
        const cleanName = name.startsWith('[') && name.endsWith(']') ? name.slice(1, -1) : name;

        // Check if it's a group reference
        if (groups.some(g => g.name === cleanName)) {
            return 'text-green-600 font-medium';
        }
        // Check if it's a node reference
        if (nodes.some(n => n.name === cleanName)) {
            return 'text-purple-600 font-medium';
        }
        // Otherwise it's a local node
        return 'text-blue-600';
    };

    const getSourceColorClass = () => {
        // Source provides "Missing" for target - color source red (muted)
        if (placeholderType === 'missing') {
            return 'text-red-500 font-medium';
        }
        return getColorClassForName(displaySource);
    };

    const getTargetColorClass = () => {
        // Target receives "Remaining" from source - color target green (muted)
        if (placeholderType === 'remaining') {
            return 'text-green-500 font-medium';
        }
        return getColorClassForName(displayTarget);
    };

    // Render source display
    const renderSource = () => {
        if (editingField === 'source') {
            return (
                <div className='w-48' onClick={e => e.stopPropagation()}>
                    <NodeCombobox
                        value={editSource}
                        onChange={setEditSource}
                        onSelect={handleSourceSave}
                        options={allOptions}
                        placeholder='Select...'
                        onCancel={() => setEditingField(null)}
                    />
                </div>
            );
        }

        // All sources are now editable
        return (
            <span
                onClick={handleSourceClick}
                className={`cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded transition-colors ${getSourceColorClass()}`}
                title='Click to change'
            >
                {displaySource}
            </span>
        );
    };

    // Render target display
    const renderTarget = () => {
        if (editingField === 'target') {
            return (
                <div className='w-48' onClick={e => e.stopPropagation()}>
                    <NodeCombobox
                        value={editTarget}
                        onChange={setEditTarget}
                        onSelect={handleTargetSave}
                        options={allOptions}
                        placeholder='Select...'
                        onCancel={() => setEditingField(null)}
                    />
                </div>
            );
        }

        // All targets are now editable
        return (
            <span
                onClick={handleTargetClick}
                className={`cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded transition-colors ${getTargetColorClass()}`}
                title='Click to change'
            >
                {displayTarget}
            </span>
        );
    };

    // Render value display
    const renderValue = () => {
        // Placeholders don't show a value
        if (placeholderType) {
            return <span className='text-gray-400 text-xs italic w-20 text-right'>auto</span>;
        }

        // Auto value shows "auto" indicator
        if (autoValue) {
            return <span className='text-blue-500 text-xs italic w-20 text-right'>auto</span>;
        }

        // Groups without subNode don't have a single value
        if (row.type === 'group-ref' && !subNode) {
            return null;
        }

        if (editingField === 'value') {
            return (
                <input
                    type='text'
                    inputMode='decimal'
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={handleValueSave}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleValueSave();
                        } else if (e.key === 'Escape') {
                            setEditingField(null);
                        }
                    }}
                    onClick={e => e.stopPropagation()}
                    autoFocus
                    className='w-20 px-2 py-0.5 border border-blue-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
            );
        }

        return (
            <span
                onClick={handleValueClick}
                className={`text-gray-600 font-mono text-sm w-20 text-right ${
                    canEditValue ? 'cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded transition-colors' : ''
                }`}
                title={canEditValue ? 'Click to change' : undefined}
            >
                {formatLocaleNumber(displayValue, locale ?? undefined)}
                {valueType === 'percent' ? '%' : ''}
            </span>
        );
    };

    return (
        <div
            draggable={editingField === null}
            onDragStart={editingField === null ? onDragStart : undefined}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            className={`flex items-center gap-3 p-3 bg-gray-50 rounded-md group transition-all ${
                isDragging ? 'opacity-50 shadow-lg' : ''
            } ${editingField === null ? 'cursor-move' : ''}`}
        >
            {/* Drag handle */}
            <div className='text-gray-400'>
                <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                    <path d='M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z' />
                </svg>
            </div>
            <div className='flex-1 flex items-center gap-2'>
                <span className='font-medium text-gray-900'>{renderSource()}</span>
                <span className='text-gray-400'>→</span>
                <span className='font-medium text-gray-900'>{renderTarget()}</span>
            </div>
            {row.type === 'direct' && (
                <div className='flex items-center gap-2 text-xs'>
                    <label className='flex items-center gap-1 text-gray-500'>
                        <input
                            type='radio'
                            name={`placeholder-${row.id}`}
                            checked={!placeholderType && !autoValue}
                            onChange={() => {
                                handlePlaceholderTypeChange(null);
                                if (autoValue) {
                                    handleAutoValueChange(false);
                                }
                            }}
                            className='w-3 h-3'
                        />
                        <span>Regular</span>
                    </label>
                    <label
                        className={`flex items-center gap-1 ${
                            sourceHasOtherAutoOrRemaining.auto || sourceHasOtherAutoOrRemaining.remaining
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-blue-600'
                        }`}
                        title={sourceHasOtherAutoOrRemaining.auto
                            ? 'Source already has an Auto connection'
                            : sourceHasOtherAutoOrRemaining.remaining
                            ? 'Source already has a Remaining connection'
                            : undefined}
                    >
                        <input
                            type='radio'
                            name={`placeholder-${row.id}`}
                            checked={autoValue}
                            onChange={() => handleAutoValueChange(true)}
                            disabled={sourceHasOtherAutoOrRemaining.auto || sourceHasOtherAutoOrRemaining.remaining}
                            className='w-3 h-3'
                        />
                        <span>Auto</span>
                    </label>
                    <label className='flex items-center gap-1 text-red-600'>
                        <input
                            type='radio'
                            name={`placeholder-${row.id}`}
                            checked={placeholderType === 'missing'}
                            onChange={() => handlePlaceholderTypeChange('missing')}
                            className='w-3 h-3'
                        />
                        <span>Missing</span>
                    </label>
                    <label
                        className={`flex items-center gap-1 ${
                            sourceHasOtherAutoOrRemaining.auto || sourceHasOtherAutoOrRemaining.remaining
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-green-600'
                        }`}
                        title={sourceHasOtherAutoOrRemaining.remaining
                            ? 'Source already has a Remaining connection'
                            : sourceHasOtherAutoOrRemaining.auto
                            ? 'Source already has an Auto connection'
                            : undefined}
                    >
                        <input
                            type='radio'
                            name={`placeholder-${row.id}`}
                            checked={placeholderType === 'remaining'}
                            onChange={() => handlePlaceholderTypeChange('remaining')}
                            disabled={sourceHasOtherAutoOrRemaining.auto || sourceHasOtherAutoOrRemaining.remaining}
                            className='w-3 h-3'
                        />
                        <span>Remaining</span>
                    </label>
                </div>
            )}
            {row.type === 'group-ref' && !subNode && (
                <label
                    className='flex items-center gap-1 text-xs text-gray-500'
                    title='Show group name as intermediate node in diagram'
                >
                    <input
                        type='checkbox'
                        checked={showGroupNode}
                        onChange={e => handleShowGroupNodeChange(e.target.checked)}
                        className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3'
                    />
                    <span>Node</span>
                </label>
            )}
            {/* Reorder button for group references without subNode */}
            {row.type === 'group-ref' && !subNode && groupSubNodes.length > 1 && (
                <button
                    type='button'
                    onClick={() => setShowReorderModal(true)}
                    className='text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1'
                    title='Reorder nodes in this group for this scenario'
                >
                    <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4'
                        />
                    </svg>
                    <span>Reorder</span>
                </button>
            )}
            {row.type === 'group-ref' && groupSubNodes.length > 0 && (
                <select
                    value={subNode ?? ''}
                    onChange={e => handleSubNodeChange(e.target.value)}
                    className='text-xs border border-gray-200 rounded px-1 py-0.5 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
                    title='Filter to specific sub-node'
                >
                    <option value=''>All items</option>
                    {groupSubNodes.map(name => <option key={name} value={name}>.{name}</option>)}
                </select>
            )}
            {/* Auto/Remaining options for group-ref with subNode (no Missing since source is from group) */}
            {row.type === 'group-ref' && subNode && (
                <div className='flex items-center gap-2 text-xs'>
                    <label className='flex items-center gap-1 text-gray-500'>
                        <input
                            type='radio'
                            name={`placeholder-${row.id}`}
                            checked={!placeholderType && !autoValue}
                            onChange={() => {
                                handlePlaceholderTypeChange(null);
                                if (autoValue) {
                                    handleAutoValueChange(false);
                                }
                            }}
                            className='w-3 h-3'
                        />
                        <span>Value</span>
                    </label>
                    <label
                        className={`flex items-center gap-1 ${
                            sourceHasOtherAutoOrRemaining.auto || sourceHasOtherAutoOrRemaining.remaining
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-blue-600'
                        }`}
                        title={sourceHasOtherAutoOrRemaining.auto
                            ? 'Source already has an Auto connection'
                            : sourceHasOtherAutoOrRemaining.remaining
                            ? 'Source already has a Remaining connection'
                            : 'Value calculated as total incoming to source'}
                    >
                        <input
                            type='radio'
                            name={`placeholder-${row.id}`}
                            checked={autoValue}
                            onChange={() => handleAutoValueChange(true)}
                            disabled={sourceHasOtherAutoOrRemaining.auto || sourceHasOtherAutoOrRemaining.remaining}
                            className='w-3 h-3'
                        />
                        <span>Auto</span>
                    </label>
                    <label
                        className={`flex items-center gap-1 ${
                            sourceHasOtherAutoOrRemaining.auto || sourceHasOtherAutoOrRemaining.remaining
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-green-600'
                        }`}
                        title={sourceHasOtherAutoOrRemaining.remaining
                            ? 'Source already has a Remaining connection'
                            : sourceHasOtherAutoOrRemaining.auto
                            ? 'Source already has an Auto connection'
                            : 'Value calculated as remaining after other outgoing flows'}
                    >
                        <input
                            type='radio'
                            name={`placeholder-${row.id}`}
                            checked={placeholderType === 'remaining'}
                            onChange={() => handlePlaceholderTypeChange('remaining')}
                            disabled={sourceHasOtherAutoOrRemaining.auto || sourceHasOtherAutoOrRemaining.remaining}
                            className='w-3 h-3'
                        />
                        <span>Remaining</span>
                    </label>
                </div>
            )}
            {renderValue()}
            {getBadge()}
            <button
                type='button'
                onClick={onDelete}
                className='text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity'
                title='Remove'
            >
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
            </button>

            {/* Reorder Modal for Group References */}
            {row.type === 'group-ref' && row.refId && !subNode && (
                <ReorderGroupNodesModal
                    isOpen={showReorderModal}
                    onClose={() => setShowReorderModal(false)}
                    groupRefId={row.id}
                    groupName={row.refName ?? ''}
                    direction={row.direction ?? 'source'}
                    nodes={groupSubNodes.map((name, index) => {
                        // Find the value for this node from group connections
                        const group = groups.find(g => g.id === row.refId);
                        const conn = group?.connections.find(c =>
                            row.direction === 'source' ? c.target === name : c.source === name
                        );
                        // Find existing order override if any
                        const orderOverride = row.nodeOrders?.find(o => o.nodeName === name);
                        return {
                            name,
                            value: conn?.value ?? 0,
                            displayOrder: orderOverride?.displayOrder ?? index
                        };
                    })}
                />
            )}
        </div>
    );
}
