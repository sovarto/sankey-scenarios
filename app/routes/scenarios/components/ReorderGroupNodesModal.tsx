import { useState, useEffect, useCallback } from 'react';
import { useFetcher } from 'react-router';

interface NodeItem {
    name: string;
    value: number;
    displayOrder: number;
}

interface ReorderGroupNodesModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupRefId: number;
    groupName: string;
    nodes: NodeItem[];
    direction: 'source' | 'target';
}

export function ReorderGroupNodesModal({
    isOpen,
    onClose,
    groupRefId,
    groupName,
    nodes: initialNodes,
    direction,
}: ReorderGroupNodesModalProps) {
    const [ items, setItems ] = useState<NodeItem[]>([]);
    const [ draggedIndex, setDraggedIndex ] = useState<number | null>(null);
    const [ hasChanges, setHasChanges ] = useState(false);
    const fetcher = useFetcher();

    // Initialize items when modal opens
    useEffect(() => {
        if (isOpen) {
            // Sort by displayOrder initially
            const sorted = [ ...initialNodes ].sort((a, b) => a.displayOrder - b.displayOrder);
            setItems(sorted);
            setHasChanges(false);
        }
    }, [ isOpen, initialNodes ]);

    // Close modal on successful save
    useEffect(() => {
        if (fetcher.state === 'idle' && fetcher.data?.success) {
            onClose();
        }
    }, [ fetcher.state, fetcher.data, onClose ]);

    const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) {
            return;
        }

        setItems(prevItems => {
            const newItems = [ ...prevItems ];
            const [ draggedItem ] = newItems.splice(draggedIndex, 1);
            newItems.splice(index, 0, draggedItem);
            return newItems;
        });
        setDraggedIndex(index);
        setHasChanges(true);
    }, [ draggedIndex ]);

    const handleDragEnd = useCallback(() => {
        setDraggedIndex(null);
    }, []);

    const handleMoveUp = useCallback((index: number) => {
        if (index === 0) {
            return;
        }
        setItems(prevItems => {
            const newItems = [ ...prevItems ];
            [ newItems[index - 1], newItems[index] ] = [ newItems[index], newItems[index - 1] ];
            return newItems;
        });
        setHasChanges(true);
    }, []);

    const handleMoveDown = useCallback((index: number) => {
        if (index === items.length - 1) {
            return;
        }
        setItems(prevItems => {
            const newItems = [ ...prevItems ];
            [ newItems[index], newItems[index + 1] ] = [ newItems[index + 1], newItems[index] ];
            return newItems;
        });
        setHasChanges(true);
    }, [ items.length ]);

    const handleSave = useCallback(() => {
        const orderData = items.map((item, index) => ({
            nodeName: item.name,
            order: index
        }));

        void fetcher.submit(
            {
                intent: 'update-group-node-order',
                groupRefId: groupRefId.toString(),
                orderData: JSON.stringify(orderData)
            },
            { method: 'post' }
        );
    }, [ items, groupRefId, fetcher ]);

    const handleReset = useCallback(() => {
        void fetcher.submit(
            {
                intent: 'reset-group-node-order',
                groupRefId: groupRefId.toString()
            },
            { method: 'post' }
        );
    }, [ groupRefId, fetcher ]);

    if (!isOpen) {
        return null;
    }

    const isSaving = fetcher.state === 'submitting';

    return (
        <div className='fixed inset-0 z-50 overflow-y-auto'>
            {/* Backdrop */}
            <div className='fixed inset-0 bg-black/50 transition-opacity' onClick={onClose} />

            {/* Modal */}
            <div className='flex min-h-full items-center justify-center p-4'>
                <div className='relative w-full max-w-md transform rounded-lg bg-white shadow-xl transition-all'>
                    {/* Header */}
                    <div className='border-b border-gray-200 px-6 py-4'>
                        <div className='flex items-center justify-between'>
                            <h3 className='text-lg font-semibold text-gray-900'>Reorder Group Nodes</h3>
                            <button type='button' onClick={onClose} className='text-gray-400 hover:text-gray-600'>
                                <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                    <path
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                        strokeWidth={2}
                                        d='M6 18L18 6M6 6l12 12'
                                    />
                                </svg>
                            </button>
                        </div>
                        <p className='mt-1 text-sm text-gray-500'>
                            Drag and drop or use arrows to reorder nodes in{' '}
                            <span className='font-medium'>{groupName}</span>
                        </p>
                        <p className='mt-1 text-xs text-gray-400'>
                            Direction: {direction === 'source' ? 'These are targets' : 'These are sources'}
                        </p>
                    </div>

                    {/* Content */}
                    <div className='px-6 py-4 max-h-96 overflow-y-auto'>
                        {items.length === 0
                            ? <p className='text-gray-500 text-center py-4'>No nodes to reorder</p>
                            : (
                                <div className='space-y-2'>
                                    {items.map((item, index) => (
                                        <div
                                            key={item.name}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, index)}
                                            onDragOver={(e) => handleDragOver(e, index)}
                                            onDragEnd={handleDragEnd}
                                            className={`
                                            flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200
                                            cursor-grab active:cursor-grabbing
                                            ${
                                                draggedIndex === index
                                                    ? 'opacity-50 border-blue-400 bg-blue-50'
                                                    : 'hover:bg-gray-100'
                                            }
                                            transition-colors
                                        `}
                                        >
                                            {/* Drag handle */}
                                            <div className='text-gray-400'>
                                                <svg
                                                    className='h-5 w-5'
                                                    fill='none'
                                                    stroke='currentColor'
                                                    viewBox='0 0 24 24'
                                                >
                                                    <path
                                                        strokeLinecap='round'
                                                        strokeLinejoin='round'
                                                        strokeWidth={2}
                                                        d='M4 8h16M4 16h16'
                                                    />
                                                </svg>
                                            </div>

                                            {/* Node info */}
                                            <div className='flex-1 min-w-0'>
                                                <div className='font-medium text-gray-900 truncate'>{item.name}</div>
                                                <div className='text-sm text-gray-500'>Value: {item.value}</div>
                                            </div>

                                            {/* Position indicator */}
                                            <div className='text-xs text-gray-400 w-6 text-center'>#{index + 1}</div>

                                            {/* Up/Down buttons */}
                                            <div className='flex flex-col gap-1'>
                                                <button
                                                    type='button'
                                                    onClick={() => handleMoveUp(index)}
                                                    disabled={index === 0}
                                                    className='p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed'
                                                    title='Move up'
                                                >
                                                    <svg
                                                        className='h-4 w-4'
                                                        fill='none'
                                                        stroke='currentColor'
                                                        viewBox='0 0 24 24'
                                                    >
                                                        <path
                                                            strokeLinecap='round'
                                                            strokeLinejoin='round'
                                                            strokeWidth={2}
                                                            d='M5 15l7-7 7 7'
                                                        />
                                                    </svg>
                                                </button>
                                                <button
                                                    type='button'
                                                    onClick={() => handleMoveDown(index)}
                                                    disabled={index === items.length - 1}
                                                    className='p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed'
                                                    title='Move down'
                                                >
                                                    <svg
                                                        className='h-4 w-4'
                                                        fill='none'
                                                        stroke='currentColor'
                                                        viewBox='0 0 24 24'
                                                    >
                                                        <path
                                                            strokeLinecap='round'
                                                            strokeLinejoin='round'
                                                            strokeWidth={2}
                                                            d='M19 9l-7 7-7-7'
                                                        />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                    </div>

                    {/* Footer */}
                    <div className='border-t border-gray-200 px-6 py-4 flex items-center justify-between'>
                        <button
                            type='button'
                            onClick={handleReset}
                            disabled={isSaving}
                            className='text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50'
                        >
                            Reset to Default
                        </button>
                        <div className='flex gap-3'>
                            <button
                                type='button'
                                onClick={onClose}
                                disabled={isSaving}
                                className='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50'
                            >
                                Cancel
                            </button>
                            <button
                                type='button'
                                onClick={handleSave}
                                disabled={isSaving || !hasChanges}
                                className='px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                            >
                                {isSaving ? 'Saving...' : 'Save Order'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
