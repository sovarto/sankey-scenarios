import { useState, useRef, useEffect } from 'react';
import { useFetcher } from 'react-router';

export function EditableLocalNode({ localNodeId, name }: { localNodeId: number; name: string }) {
    const [ isEditing, setIsEditing ] = useState(false);
    const [ editValue, setEditValue ] = useState(name);
    const fetcher = useFetcher();
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [ isEditing ]);

    useEffect(() => {
        if (fetcher.state === 'idle') {
            setIsEditing(false);
        }
    }, [ fetcher.state ]);

    useEffect(() => {
        setEditValue(name);
    }, [ name ]);

    const handleSave = () => {
        const trimmed = editValue.trim();
        if (trimmed && trimmed !== name) {
            void fetcher.submit(
                {
                    intent: 'update-local-node',
                    localNodeId: localNodeId.toString(),
                    name: trimmed
                },
                { method: 'post' }
            );
        } else {
            setEditValue(name);
            setIsEditing(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            setEditValue(name);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type='text'
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                onClick={e => e.stopPropagation()}
                className='px-1 py-0.5 border border-blue-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-32'
                disabled={fetcher.state !== 'idle'}
            />
        );
    }

    return (
        <span
            onClick={e => {
                e.stopPropagation();
                setIsEditing(true);
            }}
            className='cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded transition-colors'
            title='Click to edit'
        >
            {name}
        </span>
    );
}
