import { useState, useEffect } from 'react';
import { useFetcher } from 'react-router';
import { EditableConnectionRow } from './EditableConnectionRow';
import type { ConnectionRowData } from './types';

export function ConnectionList({
    rows,
    projectId,
    groups,
    nodes,
    localNodes,
    onDelete,
}: {
    rows: ConnectionRowData[];
    projectId: number;
    groups: Array<{ id: number; name: string }>;
    nodes: Array<{ id: number; name: string; value: number }>;
    localNodes: Array<{ id: number; name: string }>;
    onDelete: (row: ConnectionRowData) => void;
}) {
    const [ items, setItems ] = useState(rows);
    const [ draggedIndex, setDraggedIndex ] = useState<number | null>(null);
    const fetcher = useFetcher();

    // Create a stable key from the rows order to detect changes
    const rowsKey = rows.map(r => `${r.type}-${r.id}`).join(',');

    // Sync with props when they change
    useEffect(() => {
        setItems(rows);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ rowsKey ]);

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) {
            return;
        }

        const newItems = [ ...items ];
        const [ draggedItem ] = newItems.splice(draggedIndex, 1);
        newItems.splice(index, 0, draggedItem);
        setItems(newItems);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        if (draggedIndex === null) {
            return;
        }
        setDraggedIndex(null);

        // Save new order
        const orderData = items.map((item, index) => ({
            type: item.type,
            id: item.id,
            order: index
        }));

        void fetcher.submit(
            { intent: 'reorder-connections', orderData: JSON.stringify(orderData) },
            { method: 'post' }
        );
    };

    if (items.length === 0) {
        return <p className='text-gray-500 mb-6'>No connections yet.</p>;
    }

    return (
        <div className='space-y-2 mb-6'>
            {items.map((row, index) => (
                <EditableConnectionRow
                    key={`${row.type}-${row.id}-${row.source}-${row.target}`}
                    row={row}
                    projectId={projectId}
                    groups={groups}
                    nodes={nodes}
                    localNodes={localNodes}
                    onDelete={() => onDelete(row)}
                    isDragging={draggedIndex === index}
                    onDragStart={e => handleDragStart(e, index)}
                    onDragOver={e => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                />
            ))}
        </div>
    );
}
