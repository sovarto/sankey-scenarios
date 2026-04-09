import { useState, useEffect } from 'react';
import { useFetcher } from 'react-router';
import { EditableGroupConnectionRow } from './EditableGroupConnectionRow';

interface GroupConnection {
    id: number;
    source: string | null;
    target: string | null;
    value: number;
    valueExpression: string | null;
    valueDescription: string | null;
    displayOrder: number;
}

export function GroupConnectionList({
    connections,
    locale,
}: {
    connections: GroupConnection[];
    locale?: string | null;
}) {
    const [ items, setItems ] = useState(connections);
    const [ draggedIndex, setDraggedIndex ] = useState<number | null>(null);
    const fetcher = useFetcher();

    const connectionsKey = connections.map(c => `${c.id}-${c.source}-${c.value}`).join(',');

    useEffect(() => {
        setItems(connections);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ connectionsKey ]);

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

        const orderData = items.map((item, index) => ({
            id: item.id,
            order: index
        }));

        void fetcher.submit(
            { intent: 'reorder-connections', orderData: JSON.stringify(orderData) },
            { method: 'post' }
        );
    };

    if (items.length === 0) {
        return <p className='text-gray-500 text-sm'>No connections yet.</p>;
    }

    return (
        <div className='space-y-2'>
            {items.map((conn, index) => (
                <EditableGroupConnectionRow
                    key={`${conn.id}-${conn.source}`}
                    connection={conn}
                    isDragging={draggedIndex === index}
                    onDragStart={e => handleDragStart(e, index)}
                    onDragOver={e => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    locale={locale}
                />
            ))}
        </div>
    );
}
