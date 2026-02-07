import { useState, useRef, useEffect } from 'react';
import { useFetcher } from 'react-router';

interface LocalNode {
    id: number;
    name: string;
}

interface Group {
    id: number;
    name: string;
}

interface ConnectionInfo {
    sourceLocalNodeId?: number;
    targetLocalNodeId?: number;
    value: number;
    placeholderType?: 'missing' | 'remaining' | null;
}

interface LocalNodeFlowInfo {
    node: LocalNode;
    incomingFlows: number[];
    outgoingFlows: number[];
    canMove: boolean;
    deducedValue: number | null;
}

function computeNodeFlowInfo(localNodes: LocalNode[], connections: ConnectionInfo[]): Map<number, LocalNodeFlowInfo> {
    const flowMap = new Map<number, LocalNodeFlowInfo>();

    for (const node of localNodes) {
        // Count ALL connections (including auto flows with value 0) to determine if node can be moved
        const allIncoming = connections.filter(c => c.targetLocalNodeId === node.id);
        const allOutgoing = connections.filter(c => c.sourceLocalNodeId === node.id);

        // Get non-zero values for display/deduction purposes
        const incomingValues = allIncoming.filter(c => c.value > 0).map(c => c.value);
        const outgoingValues = allOutgoing.filter(c => c.value > 0).map(c => c.value);

        // Check if this node is a target of a 'remaining' placeholder connection - these cannot be promoted
        const isRemainingTarget = allIncoming.some(c => c.placeholderType === 'remaining');

        // Can move if there's exactly one incoming connection OR exactly one outgoing connection (but not both having multiple)
        // This includes auto flows - a node with one auto incoming and one manual incoming still has 2 connections
        // Also exclude nodes that are targets of 'remaining' placeholder connections
        const hasSingleIncoming = allIncoming.length === 1 && allOutgoing.length === 0;
        const hasSingleOutgoing = allOutgoing.length === 1 && allIncoming.length === 0;
        const canMove = !isRemainingTarget && (hasSingleIncoming || hasSingleOutgoing);

        let deducedValue: number | null = null;
        if (hasSingleIncoming && incomingValues.length === 1) {
            deducedValue = incomingValues[0];
        } else if (hasSingleOutgoing && outgoingValues.length === 1) {
            deducedValue = outgoingValues[0];
        }

        flowMap.set(node.id, {
            node,
            incomingFlows: incomingValues,
            outgoingFlows: outgoingValues,
            canMove,
            deducedValue
        });
    }

    return flowMap;
}

interface NodeReferenceInfo {
    connectingLocalNodeId?: number;
}

export function LocalNodesPanel({
    localNodes,
    groups,
    projectId,
    connections,
    nodeReferences = [],
}: {
    localNodes: LocalNode[];
    groups: Group[];
    projectId: number;
    connections: ConnectionInfo[];
    nodeReferences?: NodeReferenceInfo[];
}) {
    const [ selectedNodes, setSelectedNodes ] = useState<Set<number>>(new Set());
    const [ showNewGroupInput, setShowNewGroupInput ] = useState(false);
    const [ newGroupName, setNewGroupName ] = useState('');
    const fetcher = useFetcher();
    const newGroupInputRef = useRef<HTMLInputElement>(null);

    // Filter out local nodes that are already connected to project node references
    const nodeRefLocalNodeIds = new Set(
        nodeReferences.map(nr => nr.connectingLocalNodeId).filter((id): id is number => id != null)
    );
    const availableLocalNodes = localNodes.filter(n => !nodeRefLocalNodeIds.has(n.id));

    const flowInfoMap = computeNodeFlowInfo(availableLocalNodes, connections);
    const movableNodes = availableLocalNodes.filter(n => flowInfoMap.get(n.id)?.canMove);

    useEffect(() => {
        if (showNewGroupInput && newGroupInputRef.current) {
            newGroupInputRef.current.focus();
        }
    }, [ showNewGroupInput ]);

    // Display errors from the server
    useEffect(() => {
        if (fetcher.state === 'idle' && fetcher.data && typeof fetcher.data === 'object' && 'error' in fetcher.data) {
            alert(fetcher.data.error);
        }
    }, [ fetcher.state, fetcher.data ]);

    const toggleNode = (nodeId: number) => {
        const flowInfo = flowInfoMap.get(nodeId);
        if (!flowInfo?.canMove) {
            return;
        }

        setSelectedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    };

    const selectAll = () => {
        setSelectedNodes(new Set(movableNodes.map(n => n.id)));
    };

    const clearSelection = () => {
        setSelectedNodes(new Set());
    };

    const getSelectedNodesValue = (): number | null => {
        const selectedArray = Array.from(selectedNodes);
        if (selectedArray.length === 0) {
            return null;
        }

        const values = selectedArray.map(id => flowInfoMap.get(id)?.deducedValue).filter((v): v is number =>
            v !== null
        );
        if (values.length === 0) {
            return null;
        }

        // If all selected nodes have the same value, return it
        if (values.every(v => v === values[0])) {
            return values[0];
        }
        return null;
    };

    const handlePromoteToProjectNode = () => {
        if (selectedNodes.size === 0) {
            return;
        }

        const nodeIds = Array.from(selectedNodes);
        const nodeInfos = nodeIds.map(id => ({
            id,
            flowInfo: flowInfoMap.get(id)
        })).filter((info): info is { id: number; flowInfo: LocalNodeFlowInfo } => info.flowInfo != null);

        if (nodeInfos.length === 0) {
            return;
        }

        // Build the promotion data for each node
        const promotions = nodeInfos.map(({ id, flowInfo }) => {
            const direction = flowInfo.incomingFlows.length === 1 ? 'target' : 'source';
            return {
                localNodeId: id,
                value: flowInfo.deducedValue ?? 1,
                direction,
                name: flowInfo.node.name
            };
        });

        // Show a confirmation with all nodes to be promoted
        const nodeNames = promotions.map(p => `"${p.name}" (value: ${p.value})`).join('\n');
        const message = promotions.length === 1
            ? `Promote "${promotions[0].name}" to project node with value ${promotions[0].value}?`
            : `Promote ${promotions.length} local nodes to project nodes?\n\n${nodeNames}`;

        if (!confirm(message)) {
            return;
        }

        void fetcher.submit(
            {
                intent: 'promote-to-project-node',
                promotions: JSON.stringify(promotions)
            },
            { method: 'post' }
        );
        setSelectedNodes(new Set());
    };

    const handleAddToGroup = (groupId: number | 'new') => {
        if (groupId === 'new') {
            setShowNewGroupInput(true);
            return;
        }

        if (selectedNodes.size === 0) {
            return;
        }

        const nodeIds = Array.from(selectedNodes);

        void fetcher.submit(
            {
                intent: 'add-local-nodes-to-group',
                localNodeIds: JSON.stringify(nodeIds),
                groupId: groupId.toString()
            },
            { method: 'post' }
        );
        setSelectedNodes(new Set());
    };

    const handleCreateNewGroup = () => {
        if (!newGroupName.trim()) {
            alert('Group name is required');
            return;
        }

        if (selectedNodes.size === 0) {
            return;
        }

        const nodeIds = Array.from(selectedNodes);

        void fetcher.submit(
            {
                intent: 'add-local-nodes-to-new-group',
                localNodeIds: JSON.stringify(nodeIds),
                groupName: newGroupName.trim()
            },
            { method: 'post' }
        );
        setSelectedNodes(new Set());
        setShowNewGroupInput(false);
        setNewGroupName('');
    };

    if (localNodes.length === 0) {
        return null;
    }

    const hasSelection = selectedNodes.size > 0;
    const hasSingleSelection = selectedNodes.size === 1;

    return (
        <section className='bg-white rounded-lg shadow p-6 mb-8'>
            <div className='flex items-center justify-between mb-2'>
                <h2 className='text-xl font-semibold text-gray-900'>Local Nodes</h2>
                {hasSelection && (
                    <div className='flex items-center gap-2'>
                        <span className='text-sm text-gray-500'>{selectedNodes.size} selected</span>
                        <button
                            type='button'
                            onClick={clearSelection}
                            className='text-sm text-gray-500 hover:text-gray-700'
                        >
                            Clear
                        </button>
                    </div>
                )}
            </div>
            <p className='text-sm text-gray-500 mb-4'>
                Click a chip to rename. Nodes with a single flow can be selected to move to a project node or group.
            </p>

            {/* Bulk action bar */}
            {hasSelection && (
                <div className='flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg'>
                    <button
                        type='button'
                        onClick={handlePromoteToProjectNode}
                        className='px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors'
                        disabled={fetcher.state !== 'idle'}
                    >
                        Promote to Project Node{selectedNodes.size > 1 ? 's' : ''}
                    </button>
                    <div className='relative group'>
                        <button
                            type='button'
                            className='px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors flex items-center gap-1'
                            disabled={fetcher.state !== 'idle'}
                        >
                            Add to Group
                            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
                            </svg>
                        </button>
                        <div className='absolute left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10'>
                            <button
                                type='button'
                                onClick={() => handleAddToGroup('new')}
                                className='w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 font-medium border-b border-gray-100 rounded-t-md'
                            >
                                + Create New Group
                            </button>
                            {groups.map(group => (
                                <button
                                    key={group.id}
                                    type='button'
                                    onClick={() => handleAddToGroup(group.id)}
                                    className='w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 last:rounded-b-md'
                                >
                                    {group.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* New group input */}
            {showNewGroupInput && (
                <div className='flex items-center gap-2 mb-4 p-3 bg-green-50 rounded-lg'>
                    <input
                        ref={newGroupInputRef}
                        type='text'
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreateNewGroup();
                            } else if (e.key === 'Escape') {
                                setShowNewGroupInput(false);
                                setNewGroupName('');
                            }
                        }}
                        placeholder='New group name...'
                        className='flex-1 px-3 py-1.5 border border-green-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500'
                    />
                    <button
                        type='button'
                        onClick={handleCreateNewGroup}
                        className='px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors'
                    >
                        Create & Add
                    </button>
                    <button
                        type='button'
                        onClick={() => {
                            setShowNewGroupInput(false);
                            setNewGroupName('');
                        }}
                        className='px-3 py-1.5 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400 transition-colors'
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* Selection controls */}
            {movableNodes.length > 0 && (
                <div className='flex items-center gap-2 mb-3'>
                    <button type='button' onClick={selectAll} className='text-xs text-blue-600 hover:text-blue-800'>
                        Select All Movable
                    </button>
                    {hasSelection && (
                        <button
                            type='button'
                            onClick={clearSelection}
                            className='text-xs text-gray-500 hover:text-gray-700'
                        >
                            Clear Selection
                        </button>
                    )}
                </div>
            )}

            <div className='flex flex-wrap gap-2'>
                {availableLocalNodes.map(node => {
                    const flowInfo = flowInfoMap.get(node.id);
                    return (
                        <LocalNodeChip
                            key={node.id}
                            node={node}
                            isSelected={selectedNodes.has(node.id)}
                            canSelect={flowInfo?.canMove ?? false}
                            flowInfo={flowInfo}
                            onToggleSelect={() => toggleNode(node.id)}
                        />
                    );
                })}
            </div>
        </section>
    );
}

function LocalNodeChip({
    node,
    isSelected,
    canSelect,
    flowInfo,
    onToggleSelect,
}: {
    node: LocalNode;
    isSelected: boolean;
    canSelect: boolean;
    flowInfo?: LocalNodeFlowInfo;
    onToggleSelect: () => void;
}) {
    const [ isEditing, setIsEditing ] = useState(false);
    const [ editValue, setEditValue ] = useState(node.name);
    const fetcher = useFetcher();
    const inputRef = useRef<HTMLInputElement>(null);
    const hasSubmittedRef = useRef(false);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [ isEditing ]);

    // Only close editing after a successful submit
    useEffect(() => {
        if (hasSubmittedRef.current && fetcher.state === 'idle' && fetcher.data) {
            setIsEditing(false);
            hasSubmittedRef.current = false;
        }
    }, [ fetcher.state, fetcher.data ]);

    useEffect(() => {
        setEditValue(node.name);
    }, [ node.name ]);

    const handleSave = () => {
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== node.name) {
            hasSubmittedRef.current = true;
            void fetcher.submit(
                {
                    intent: 'update-local-node',
                    localNodeId: node.id.toString(),
                    name: trimmed
                },
                { method: 'post' }
            );
        } else {
            setEditValue(node.name);
            setIsEditing(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            setEditValue(node.name);
            setIsEditing(false);
        }
    };

    // Build tooltip showing flow info
    const getTooltip = () => {
        if (!flowInfo) {
            return 'Click to rename';
        }
        const parts: string[] = [ 'Click to rename' ];
        if (flowInfo.incomingFlows.length > 0) {
            parts.push(`In: ${flowInfo.incomingFlows.join(', ')}`);
        }
        if (flowInfo.outgoingFlows.length > 0) {
            parts.push(`Out: ${flowInfo.outgoingFlows.join(', ')}`);
        }
        if (!flowInfo.canMove) {
            parts.push('(Cannot move: needs single flow)');
        }
        return parts.join(' | ');
    };

    if (isEditing) {
        return (
            <div className='flex items-center gap-1'>
                {canSelect && (
                    <input
                        type='checkbox'
                        checked={isSelected}
                        onChange={onToggleSelect}
                        className='w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
                    />
                )}
                <input
                    ref={inputRef}
                    type='text'
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className='px-3 py-1.5 border border-blue-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32'
                    disabled={fetcher.state !== 'idle'}
                />
            </div>
        );
    }

    return (
        <div className='flex items-center gap-1'>
            {canSelect && (
                <input
                    type='checkbox'
                    checked={isSelected}
                    onChange={onToggleSelect}
                    className='w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
                />
            )}
            <button
                type='button'
                onClick={() => setIsEditing(true)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    isSelected
                        ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        : canSelect
                        ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-500'
                }`}
                title={getTooltip()}
            >
                {node.name}
                {flowInfo?.deducedValue !== null && flowInfo?.deducedValue !== undefined && (
                    <span className='ml-1 text-xs text-gray-400'>({flowInfo.deducedValue})</span>
                )}
            </button>
        </div>
    );
}
