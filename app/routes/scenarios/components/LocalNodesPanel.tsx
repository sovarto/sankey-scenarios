import { useState, useRef, useEffect } from 'react';
import { useFetcher } from 'react-router';

interface LocalNode {
    id: number;
    name: string;
}

export function LocalNodesPanel({
    localNodes,
}: {
    localNodes: LocalNode[];
}) {
    if (localNodes.length === 0) {
        return null;
    }

    return (
        <section className='bg-white rounded-lg shadow p-6 mb-8'>
            <h2 className='text-xl font-semibold text-gray-900 mb-2'>Local Nodes</h2>
            <p className='text-sm text-gray-500 mb-4'>Rename a local node here to update it everywhere it's used.</p>
            <div className='flex flex-wrap gap-2'>
                {localNodes.map(node => <LocalNodeChip key={node.id} node={node} />)}
            </div>
        </section>
    );
}

function LocalNodeChip({ node }: { node: LocalNode }) {
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

    if (isEditing) {
        return (
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
        );
    }

    return (
        <button
            type='button'
            onClick={() => setIsEditing(true)}
            className='px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors'
            title='Click to rename'
        >
            {node.name}
        </button>
    );
}
