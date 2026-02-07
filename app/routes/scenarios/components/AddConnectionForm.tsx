import { useState, useMemo } from 'react';
import { useFetcher } from 'react-router';
import { NodeCombobox } from './NodeCombobox';
import type { ComboboxOption } from './types';

export function AddConnectionForm({
    groups,
    nodes,
    localNodes,
}: {
    groups: Array<{ id: number; name: string }>;
    nodes: Array<{ id: number; name: string; value: number }>;
    localNodes: Array<{ id: number; name: string }>;
}) {
    const [ source, setSource ] = useState<ComboboxOption | null>(null);
    const [ target, setTarget ] = useState<ComboboxOption | null>(null);
    const [ value, setValue ] = useState('');
    const [ showGroupNode, setShowGroupNode ] = useState(false);
    const fetcher = useFetcher();

    // Build options list
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

        // Group references
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

    // Filter options for each side based on the other's selection
    const sourceOptions = useMemo(() => {
        if (target && target.type !== 'local') {
            // Only allow local options when target is a reference
            return allOptions.filter(o => o.type === 'local');
        }
        return allOptions;
    }, [ allOptions, target ]);

    const targetOptions = useMemo(() => {
        if (source && source.type !== 'local') {
            // Only allow local options when source is a reference
            return allOptions.filter(o => o.type === 'local');
        }
        return allOptions;
    }, [ allOptions, source ]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!source || !target) {
            return;
        }

        const formData: Record<string, string> = {
            intent: 'add-connection',
            sourceType: source.type,
            targetType: target.type,
            source: source.name,
            target: target.name
        };

        if (source.type === 'node' && source.id) {
            formData.sourceRefId = source.id.toString();
        } else if (source.type === 'group' && source.id) {
            formData.sourceRefId = source.id.toString();
            formData.showGroupNode = showGroupNode ? '1' : '0';
        }

        if (target.type === 'node' && target.id) {
            formData.targetRefId = target.id.toString();
        } else if (target.type === 'group' && target.id) {
            formData.targetRefId = target.id.toString();
            formData.showGroupNode = showGroupNode ? '1' : '0';
        }

        // Value is only needed for direct connections
        if (source.type === 'local' && target.type === 'local') {
            formData.value = value;
        }

        void fetcher.submit(formData, { method: 'post' });

        // Reset form
        setSource(null);
        setTarget(null);
        setValue('');
        setShowGroupNode(false);
    };

    const isValueHidden = (source?.type !== 'local') || (target?.type !== 'local');
    const isGroupRef = source?.type === 'group' || target?.type === 'group';
    const isValid = source && target && (isValueHidden || (value && parseFloat(value) > 0));

    return (
        <div className='border-t pt-4'>
            <h3 className='text-sm font-medium text-gray-700 mb-3'>Add Connection</h3>
            <fetcher.Form onSubmit={handleSubmit} className='space-y-3'>
                <div className='grid grid-cols-[1fr,auto,1fr,auto,auto] gap-3 items-end'>
                    {/* Source */}
                    <div>
                        <label className='text-xs text-gray-500 block mb-1'>Source</label>
                        <NodeCombobox
                            value={source}
                            onChange={setSource}
                            options={sourceOptions}
                            placeholder='Type or select...'
                        />
                    </div>

                    {/* Arrow */}
                    <span className='text-gray-400 text-xl pb-2'>→</span>

                    {/* Target */}
                    <div>
                        <label className='text-xs text-gray-500 block mb-1'>Target</label>
                        <NodeCombobox
                            value={target}
                            onChange={setTarget}
                            options={targetOptions}
                            placeholder='Type or select...'
                        />
                    </div>

                    {/* Value */}
                    <div className={isValueHidden ? 'opacity-30' : ''}>
                        <label className='text-xs text-gray-500 block mb-1'>Value</label>
                        <input
                            type='number'
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            placeholder='0'
                            min='0.01'
                            step='0.01'
                            required={!isValueHidden}
                            disabled={isValueHidden}
                            className='w-24 px-3 py-2 border border-gray-300 rounded-md text-sm'
                        />
                    </div>

                    {/* Submit */}
                    <button
                        type='submit'
                        disabled={!isValid}
                        className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                        Add
                    </button>
                </div>

                {isValueHidden && source && target && (
                    <p className='text-xs text-gray-500'>
                        Value comes from the referenced {source.type !== 'local' ? 'node/group' : 'node/group'}.
                    </p>
                )}

                {isGroupRef && (
                    <label className='flex items-center gap-2 text-sm text-gray-700'>
                        <input
                            type='checkbox'
                            checked={showGroupNode}
                            onChange={e => setShowGroupNode(e.target.checked)}
                            className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                        />
                        Show group name as node in diagram
                    </label>
                )}
            </fetcher.Form>
        </div>
    );
}
