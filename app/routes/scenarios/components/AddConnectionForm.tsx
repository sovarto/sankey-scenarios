import { useState, useMemo } from 'react';
import { useFetcher } from 'react-router';
import { NodeCombobox } from './NodeCombobox';
import { parseLocaleNumber } from './numberUtils';
import type { ComboboxOption, GroupWithConnections } from './types';

/** Special value keywords for connection types */
const SPECIAL_VALUES = {
    auto: [ 'a', 'auto' ] as const,
    missing: [ '?', 'm', 'missing' ] as const,
    remaining: [ '*', 'r', 'remaining' ] as const
};

/** Parse value field to determine connection type and numeric value */
function parseValueField(
    value: string,
    locale?: string,
): { type: 'regular' | 'auto' | 'missing' | 'remaining'; numericValue: number } {
    const trimmed = value.trim().toLowerCase();

    if ((SPECIAL_VALUES.auto as readonly string[]).includes(trimmed)) {
        return { type: 'auto', numericValue: 0 };
    }
    if ((SPECIAL_VALUES.missing as readonly string[]).includes(trimmed)) {
        return { type: 'missing', numericValue: 0 };
    }
    if ((SPECIAL_VALUES.remaining as readonly string[]).includes(trimmed)) {
        return { type: 'remaining', numericValue: 0 };
    }

    return { type: 'regular', numericValue: parseLocaleNumber(value, locale) };
}

interface TargetRow {
    id: number;
    target: ComboboxOption | null;
    value: string;
}

export function AddConnectionForm({
    groups,
    nodes,
    localNodes,
    existingPlaceholders,
    locale,
}: {
    groups: GroupWithConnections[];
    nodes: Array<{ id: number; name: string; value: number }>;
    localNodes: Array<{ id: number; name: string }>;
    /** Existing placeholder/auto connections to prevent duplicates */
    existingPlaceholders?: Array<{ nodeName: string; type: 'missing' | 'remaining' | 'auto'; connectionId?: number }>;
    locale?: string | null;
}) {
    const [ source, setSource ] = useState<ComboboxOption | null>(null);
    const [ sourceSubNode, setSourceSubNode ] = useState<string>(''); // '' = all, otherwise specific sub-node
    const [ targetRows, setTargetRows ] = useState<TargetRow[]>([ { id: 1, target: null, value: '' } ]);
    const [ targetSubNode, setTargetSubNode ] = useState<string>(''); // '' = all, otherwise specific sub-node
    const [ showGroupNode, setShowGroupNode ] = useState(false);
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

    // Build options list (one entry per group, no sub-nodes in main dropdown)
    const allOptions: ComboboxOption[] = useMemo(() => {
        const opts: ComboboxOption[] = [];

        // Node references
        for (const node of nodes) {
            opts.push({
                type: 'node',
                id: node.id,
                name: node.name,
                value: node.value,
                display: `Node: ${node.name}`
            });
        }

        // Group references - single entry per group
        for (const group of groups) {
            opts.push({
                type: 'group',
                id: group.id,
                name: group.name,
                display: `Group: ${group.name}`
            });
        }

        // Local nodes (from scenario's localNodes table)
        for (const localNode of localNodes) {
            // Don't duplicate if it matches a node reference
            if (!nodes.some(n => n.name === localNode.name)) {
                opts.push({
                    type: 'local',
                    name: localNode.name,
                    display: `Local: ${localNode.name}`
                });
            }
        }

        return opts;
    }, [ nodes, groups, localNodes ]);

    // Filter options for source - if any target is a reference, only allow local
    const sourceOptions = useMemo(() => {
        const hasReferenceTarget = targetRows.some(r => r.target && r.target.type !== 'local');
        if (hasReferenceTarget) {
            return allOptions.filter(o => o.type === 'local');
        }
        return allOptions;
    }, [ allOptions, targetRows ]);

    // Filter options for targets based on source selection
    const targetOptions = useMemo(() => {
        if (source && source.type !== 'local') {
            // Only allow local options when source is a reference
            return allOptions.filter(o => o.type === 'local');
        }
        return allOptions;
    }, [ allOptions, source ]);

    // Check if we can add multiple targets (only for local source with local targets)
    const canAddMultipleTargets = useMemo(() => {
        if (!source || source.type !== 'local') {
            return false;
        }
        // All existing targets must be local
        return targetRows.every(r => !r.target || r.target.type === 'local');
    }, [ source, targetRows ]);

    const addTargetRow = () => {
        setTargetRows(prev => [ ...prev, { id: Math.max(...prev.map(r => r.id)) + 1, target: null, value: '' } ]);
    };

    const removeTargetRow = (id: number) => {
        if (targetRows.length > 1) {
            setTargetRows(prev => prev.filter(r => r.id !== id));
        }
    };

    const updateTargetRow = (id: number, field: 'target' | 'value', value: ComboboxOption | null | string) => {
        setTargetRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!source) {
            return;
        }

        // Get valid rows
        const validRows = targetRows.filter(row => {
            if (!row.target) {
                return false;
            }
            // For local-to-local, need a value or special keyword
            if (source.type === 'local' && row.target.type === 'local') {
                if (row.value === '') {
                    return false;
                }
                const parsed = parseValueField(row.value, locale ?? undefined);
                // Special types are always valid, regular needs positive number
                return parsed.type !== 'regular' || parsed.numericValue > 0;
            }
            // For references, no value needed
            return true;
        });

        if (validRows.length === 0) {
            return;
        }

        // Submit each connection
        for (const row of validRows) {
            const formData: Record<string, string> = {
                intent: 'add-connection',
                sourceType: source.type,
                targetType: row.target!.type,
                source: source.name,
                target: row.target!.name
            };

            if (source.type === 'node' && source.id) {
                formData.sourceRefId = source.id.toString();
            } else if (source.type === 'group' && source.id) {
                formData.sourceRefId = source.id.toString();
                // Only show showGroupNode option if no subNode is selected
                if (!sourceSubNode) {
                    formData.showGroupNode = showGroupNode ? '1' : '0';
                }
                if (sourceSubNode) {
                    formData.subNode = sourceSubNode;
                    // When subNode is specified, parse value field for auto/remaining
                    if (row.value) {
                        const parsed = parseValueField(row.value, locale ?? undefined);
                        if (parsed.type === 'auto') {
                            formData.autoValue = '1';
                        } else if (parsed.type === 'remaining') {
                            formData.placeholderType = 'remaining';
                        } else if (parsed.numericValue > 0) {
                            formData.value = parsed.numericValue.toString();
                        }
                    }
                }
            }

            if (row.target!.type === 'node' && row.target!.id) {
                formData.targetRefId = row.target!.id.toString();
            } else if (row.target!.type === 'group' && row.target!.id) {
                formData.targetRefId = row.target!.id.toString();
                // Only show showGroupNode option if no subNode is selected
                if (!targetSubNode) {
                    formData.showGroupNode = showGroupNode ? '1' : '0';
                }
                if (targetSubNode) {
                    formData.subNode = targetSubNode;
                    // When subNode is specified, parse value field for auto/remaining
                    if (row.value) {
                        const parsed = parseValueField(row.value, locale ?? undefined);
                        if (parsed.type === 'auto') {
                            formData.autoValue = '1';
                        } else if (parsed.type === 'remaining') {
                            formData.placeholderType = 'remaining';
                        } else if (parsed.numericValue > 0) {
                            formData.value = parsed.numericValue.toString();
                        }
                    }
                }
            }

            // Value is only needed for direct connections
            if (source.type === 'local' && row.target!.type === 'local') {
                const parsed = parseValueField(row.value, locale ?? undefined);
                if (parsed.type === 'auto') {
                    formData.autoValue = '1';
                } else if (parsed.type === 'missing' || parsed.type === 'remaining') {
                    formData.placeholderType = parsed.type;
                } else {
                    formData.value = parsed.numericValue.toString();
                }
            }

            await fetcher.submit(formData, { method: 'post' });
        }

        // Reset form but keep source for quick additional entries
        setTargetRows([ { id: 1, target: null, value: '' } ]);
        setShowGroupNode(false);
        setSourceSubNode('');
        setTargetSubNode('');
    };

    // Show group options only when a group is selected without a specific sub-node
    const hasGroupRefWithoutSubNode = (source?.type === 'group' && !sourceSubNode)
        || targetRows.some(r => r.target?.type === 'group') && !targetSubNode;
    const isGroupRef = source?.type === 'group' || targetRows.some(r => r.target?.type === 'group');

    // Get sub-nodes for source/target if they are groups
    const sourceGroupSubNodes = source?.type === 'group' && source.id ? getGroupSubNodes(source.id) : [];
    const targetGroup = targetRows[0]?.target;
    const targetGroupSubNodes = targetGroup?.type === 'group' && targetGroup.id ? getGroupSubNodes(targetGroup.id) : [];

    // Check if value input should be shown (direct connection or group with subNode)
    const showValueInput = (source?.type === 'local' && targetRows.some(r => r.target?.type === 'local'))
        || (source?.type === 'group' && sourceSubNode)
        || (targetRows.some(r => r.target?.type === 'group') && targetSubNode);

    // Count valid rows for button text
    const validRowCount = targetRows.filter(row => {
        if (!row.target) {
            return false;
        }
        // Direct connections require value
        if (source?.type === 'local' && row.target.type === 'local') {
            if (row.value === '') {
                return false;
            }
            const parsed = parseValueField(row.value, locale ?? undefined);
            return parsed.type !== 'regular' || parsed.numericValue > 0;
        }
        // Group with subNode - value is optional (defaults to group's calculated value)
        // But if value is specified, it must be valid
        if ((source?.type === 'group' && sourceSubNode) || (row.target.type === 'group' && targetSubNode)) {
            if (row.value !== '') {
                const parsed = parseValueField(row.value, locale ?? undefined);
                return parsed.type !== 'regular' || parsed.numericValue >= 0;
            }
        }
        return true;
    }).length;

    const isValid = source && validRowCount > 0;

    return (
        <div className='border-t pt-4'>
            <h3 className='text-sm font-medium text-gray-700 mb-3'>Add Connection</h3>
            <form onSubmit={handleSubmit} className='space-y-3'>
                {/* Source */}
                <div>
                    <label className='text-xs text-gray-500 block mb-1'>Source</label>
                    <NodeCombobox
                        value={source}
                        onChange={opt => {
                            setSource(opt);
                            setSourceSubNode(''); // Reset sub-node when source changes
                            // Reset to single target when source changes to a reference
                            if (opt && opt.type !== 'local') {
                                setTargetRows([ { id: 1, target: null, value: '' } ]);
                            }
                        }}
                        options={sourceOptions}
                        placeholder='Type or select source...'
                    />
                </div>

                {/* Source sub-node selector */}
                {source?.type === 'group' && sourceGroupSubNodes.length > 0 && (
                    <div>
                        <label className='text-xs text-gray-500 block mb-1'>Sub-node (optional)</label>
                        <select
                            value={sourceSubNode}
                            onChange={e => setSourceSubNode(e.target.value)}
                            className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm'
                        >
                            <option value=''>All items</option>
                            {sourceGroupSubNodes.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </div>
                )}

                {/* Targets */}
                <div className='space-y-2'>
                    <label className='text-xs text-gray-500 block'>Target{targetRows.length > 1 ? 's' : ''}</label>
                    {targetRows.map(row => {
                        const isLocalToLocal = source?.type === 'local' && row.target?.type === 'local';
                        const isGroupWithSubNode = (source?.type === 'group' && sourceSubNode)
                            || (row.target?.type === 'group' && targetSubNode);
                        const needsValue = isLocalToLocal || isGroupWithSubNode;
                        const parsed = row.value ? parseValueField(row.value, locale ?? undefined) : null;
                        const isSpecialType = parsed && parsed.type !== 'regular';
                        // For group refs with subNode, only allow auto/remaining (not missing)
                        const valuePlaceholder = isGroupWithSubNode ? 'a * 123' : 'a ? * 123';
                        const valueTitle = isGroupWithSubNode
                            ? 'Enter: number, "a" (auto), or "*" (remaining). Leave empty to use group\'s calculated value.'
                            : 'Enter: number, "a" (auto), "?" (missing), or "*" (remaining)';

                        return (
                            <div key={row.id} className='flex items-center gap-2'>
                                <span className='text-gray-400 text-lg'>→</span>
                                <div className='flex-1'>
                                    <NodeCombobox
                                        value={row.target}
                                        onChange={val => {
                                            updateTargetRow(row.id, 'target', val);
                                            setTargetSubNode(''); // Reset sub-node when target changes
                                            // If selecting a reference, reset to single target
                                            if (val && val.type !== 'local' && targetRows.length > 1) {
                                                setTargetRows([ { id: row.id, target: val, value: '' } ]);
                                            }
                                        }}
                                        options={targetOptions}
                                        placeholder='Target...'
                                    />
                                </div>
                                {needsValue && (
                                    <div className='relative'>
                                        <input
                                            type='text'
                                            inputMode='decimal'
                                            value={row.value}
                                            onChange={e => updateTargetRow(row.id, 'value', e.target.value)}
                                            placeholder={valuePlaceholder}
                                            title={valueTitle}
                                            className={`w-24 px-3 py-2 border rounded-md text-sm ${
                                                isSpecialType
                                                    ? parsed.type === 'auto'
                                                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                                                        : parsed.type === 'missing'
                                                        ? 'border-red-400 bg-red-50 text-red-700'
                                                        : 'border-green-400 bg-green-50 text-green-700'
                                                    : 'border-gray-300'
                                            }`}
                                        />
                                    </div>
                                )}
                                {targetRows.length > 1 && (
                                    <button
                                        type='button'
                                        onClick={() => removeTargetRow(row.id)}
                                        tabIndex={-1}
                                        className='p-2 text-gray-400 hover:text-red-600 transition-colors'
                                        title='Remove'
                                    >
                                        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path
                                                strokeLinecap='round'
                                                strokeLinejoin='round'
                                                strokeWidth={2}
                                                d='M6 18L18 6M6 6l12 12'
                                            />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Target sub-node selector */}
                {targetRows[0]?.target?.type === 'group' && targetGroupSubNodes.length > 0 && (
                    <div>
                        <label className='text-xs text-gray-500 block mb-1'>Target sub-node (optional)</label>
                        <select
                            value={targetSubNode}
                            onChange={e => setTargetSubNode(e.target.value)}
                            className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm'
                        >
                            <option value=''>All items</option>
                            {targetGroupSubNodes.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </div>
                )}

                {/* Add another target button */}
                {canAddMultipleTargets && (
                    <button
                        type='button'
                        onClick={addTargetRow}
                        className='text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1'
                    >
                        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M12 6v6m0 0v6m0-6h6m-6 0H6'
                            />
                        </svg>
                        Add another target
                    </button>
                )}

                {hasGroupRefWithoutSubNode && (
                    <label className='flex items-center gap-2 text-sm text-gray-700'>
                        <input
                            type='checkbox'
                            checked={showGroupNode}
                            onChange={e => setShowGroupNode(e.target.checked)}
                            className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                        />
                        Show group name as intermediate node in diagram
                    </label>
                )}

                {isGroupRef && !hasGroupRefWithoutSubNode && (
                    <p className='text-xs text-gray-500'>Connecting to a specific sub-node within the group.</p>
                )}

                {source && source.type !== 'local' && targetRows[0]?.target && (
                    <p className='text-xs text-gray-500'>Value comes from the referenced node/group.</p>
                )}

                {/* Value shortcuts hint */}
                {source?.type === 'local' && targetRows.some(r => r.target?.type === 'local') && (
                    <div className='text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1'>
                        <span>Value shortcuts:</span>
                        <span>
                            <code className='bg-blue-100 text-blue-700 px-1 rounded'>a</code> auto
                        </span>
                        <span>
                            <code className='bg-red-100 text-red-700 px-1 rounded'>?</code> missing
                        </span>
                        <span>
                            <code className='bg-green-100 text-green-700 px-1 rounded'>*</code> remaining
                        </span>
                    </div>
                )}

                {/* Submit */}
                <button
                    type='submit'
                    disabled={!isValid}
                    className='w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed'
                >
                    {validRowCount > 1 ? `Add ${validRowCount} Connections` : 'Add Connection'}
                </button>
            </form>
        </div>
    );
}
