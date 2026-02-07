import { Link } from 'react-router';
import { EditableLocalNode } from './EditableLocalNode';
import type { ConnectionRowData } from './types';

export function ConnectionRow({
    row,
    projectId,
    onDelete,
    isDragging,
    onDragStart,
    onDragOver,
    onDragEnd,
}: {
    row: ConnectionRowData;
    projectId: number;
    onDelete: () => void;
    isDragging?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDragEnd?: () => void;
}) {
    const getBadge = () => {
        if (row.type === 'direct') {
            if (row.placeholderType === 'missing') {
                return <span className='text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded'>Missing</span>;
            }
            if (row.placeholderType === 'remaining') {
                return <span className='text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded'>Remaining</span>;
            }
            return <span className='text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded'>Direct</span>;
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

    // Determine if source/target are editable local nodes
    const sourceIsLocalNode = row.type === 'direct'
        ? row.sourceLocalNodeId
        : (row.type === 'group-ref' && row.direction === 'source')
                || (row.type === 'node-ref' && row.direction === 'target')
        ? row.connectingLocalNodeId
        : undefined;

    const targetIsLocalNode = row.type === 'direct'
        ? row.targetLocalNodeId
        : (row.type === 'group-ref' && row.direction === 'target')
                || (row.type === 'node-ref' && row.direction === 'source')
        ? row.connectingLocalNodeId
        : undefined;

    const sourceDisplay = row.type === 'group-ref' && row.direction === 'target'
        ? (
            <Link
                to={`/projects/${projectId}/groups/${row.refId}`}
                className='text-green-600 hover:text-green-800 font-medium'
            >
                [{row.refName}]
            </Link>
        )
        : row.type === 'node-ref' && row.direction === 'source'
        ? (
            <Link
                to={`/projects/${projectId}/nodes/${row.refId}`}
                className='text-purple-600 hover:text-purple-800 font-medium'
            >
                {row.refName}
            </Link>
        )
        : sourceIsLocalNode
        ? <EditableLocalNode localNodeId={sourceIsLocalNode} name={row.source} />
        : <span>{row.source}</span>;

    const targetDisplay = row.type === 'group-ref' && row.direction === 'source'
        ? (
            <Link
                to={`/projects/${projectId}/groups/${row.refId}`}
                className='text-green-600 hover:text-green-800 font-medium'
            >
                [{row.refName}]
            </Link>
        )
        : row.type === 'node-ref' && row.direction === 'target'
        ? (
            <Link
                to={`/projects/${projectId}/nodes/${row.refId}`}
                className='text-purple-600 hover:text-purple-800 font-medium'
            >
                {row.refName}
            </Link>
        )
        : targetIsLocalNode
        ? <EditableLocalNode localNodeId={targetIsLocalNode} name={row.target} />
        : <span>{row.target}</span>;

    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            className={`flex items-center gap-3 p-3 bg-gray-50 rounded-md group cursor-move transition-all ${
                isDragging ? 'opacity-50 shadow-lg' : ''
            }`}
        >
            {/* Drag handle */}
            <div className='text-gray-400 cursor-move'>
                <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                    <path d='M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z' />
                </svg>
            </div>
            <div className='flex-1 flex items-center gap-2'>
                <span className='font-medium text-gray-900'>{sourceDisplay}</span>
                <span className='text-gray-400'>→</span>
                <span className='font-medium text-gray-900'>{targetDisplay}</span>
            </div>
            {row.type !== 'group-ref' && !row.placeholderType && (
                <span className='text-gray-600 font-mono text-sm w-20 text-right'>
                    {row.value}
                    {row.valueType === 'percent' ? '%' : ''}
                </span>
            )}
            {row.placeholderType && <span className='text-gray-400 italic text-xs w-20 text-right'>auto</span>}
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
