import { useState, useMemo, useEffect } from 'react';
import { Link, useFetcher } from 'react-router';
import { NodeCombobox } from './NodeCombobox';
import type { ComboboxOption, ConnectionRowData } from './types';

interface EditableConnectionRowProps {
    row: ConnectionRowData;
    projectId: number;
    groups: Array<{ id: number; name: string }>;
    nodes: Array<{ id: number; name: string; value: number }>;
    localNodes: Array<{ id: number; name: string }>;
    onDelete: () => void;
    isDragging?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDragEnd?: () => void;
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
}: EditableConnectionRowProps) {
    const [ editingField, setEditingField ] = useState<'source' | 'target' | 'value' | null>(null);
    const [ editSource, setEditSource ] = useState<ComboboxOption | null>(null);
    const [ editTarget, setEditTarget ] = useState<ComboboxOption | null>(null);
    const [ editValue, setEditValue ] = useState('');
    const [ displaySource, setDisplaySource ] = useState(row.source);
    const [ displayTarget, setDisplayTarget ] = useState(row.target);
    const [ displayValue, setDisplayValue ] = useState(row.value);
    const fetcher = useFetcher();

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

    // Build options list (same logic as AddConnectionForm)
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

    // All sources and targets are now editable
    const canEditValue = row.type === 'direct';

    // Start editing source
    const handleSourceClick = () => {
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
        setEditValue(displayValue.toString());
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
        const numValue = parseFloat(editValue);
        if (!isNaN(numValue) && numValue > 0 && numValue !== displayValue) {
            setDisplayValue(numValue); // Optimistic update
            void fetcher.submit(
                {
                    intent: 'update-connection-value',
                    connectionId: row.id.toString(),
                    value: numValue.toString()
                },
                { method: 'post' }
            );
        }
        setEditingField(null);
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

    const getSourceColorClass = () => getColorClassForName(displaySource);
    const getTargetColorClass = () => getColorClassForName(displayTarget);

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
        if (row.type === 'group-ref') {
            return null; // Groups don't have a single value
        }

        if (editingField === 'value') {
            return (
                <input
                    type='number'
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
                    min='0.01'
                    step='0.01'
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
                {displayValue}
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
        </div>
    );
}
