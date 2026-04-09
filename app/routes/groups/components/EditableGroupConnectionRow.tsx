import { useState, useEffect, useRef } from 'react';
import { useFetcher } from 'react-router';
import { evaluateExpression, isExpression } from '~/utils/expressionEvaluator';
import { parseLocaleNumber, formatLocaleNumber } from '~/utils/numberUtils';

interface GroupConnection {
    id: number;
    source: string | null;
    target: string | null;
    value: number;
    valueExpression: string | null;
    valueDescription: string | null;
    displayOrder: number;
}

export function EditableGroupConnectionRow({
    connection,
    isDragging,
    onDragStart,
    onDragOver,
    onDragEnd,
    locale,
}: {
    connection: GroupConnection;
    isDragging?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDragEnd?: () => void;
    locale?: string | null;
}) {
    const nodeName = connection.source || connection.target || '';
    const [ editingField, setEditingField ] = useState<'name' | 'value' | null>(null);
    const [ displayName, setDisplayName ] = useState(nodeName);
    const [ displayValue, setDisplayValue ] = useState(connection.value);
    const [ displayExpression, setDisplayExpression ] = useState(connection.valueExpression);
    const [ displayDescription, setDisplayDescription ] = useState(connection.valueDescription);
    const [ editName, setEditName ] = useState(nodeName);
    const [ editValue, setEditValue ] = useState('');
    const [ editDescription, setEditDescription ] = useState('');
    const [ showDescriptionInput, setShowDescriptionInput ] = useState(false);
    const fetcher = useFetcher();
    const nameInputRef = useRef<HTMLInputElement>(null);

    // Sync display values with props
    useEffect(() => {
        setDisplayName(connection.source || connection.target || '');
    }, [ connection.source, connection.target ]);
    useEffect(() => {
        setDisplayValue(connection.value);
    }, [ connection.value ]);
    useEffect(() => {
        setDisplayExpression(connection.valueExpression);
    }, [ connection.valueExpression ]);
    useEffect(() => {
        setDisplayDescription(connection.valueDescription);
    }, [ connection.valueDescription ]);

    useEffect(() => {
        if (editingField === 'name' && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [ editingField ]);

    // Show error as popup
    const fetcherError = fetcher.data && 'error' in fetcher.data ? (fetcher.data as { error: string }).error : null;
    const lastShownError = useRef<string | null>(null);

    useEffect(() => {
        if (fetcherError && fetcherError !== lastShownError.current) {
            lastShownError.current = fetcherError;
            alert(fetcherError);
        }
    }, [ fetcherError ]);

    // Start editing name
    const handleNameClick = () => {
        setEditName(displayName);
        setEditingField('name');
    };

    // Save name change
    const handleNameSave = () => {
        const trimmed = editName.trim();
        if (trimmed && trimmed !== displayName) {
            setDisplayName(trimmed);
            void fetcher.submit(
                {
                    intent: 'update-connection-name',
                    connectionId: connection.id.toString(),
                    name: trimmed
                },
                { method: 'post' }
            );
        } else {
            setEditName(displayName);
        }
        setEditingField(null);
    };

    // Start editing value
    const handleValueClick = () => {
        if (displayExpression) {
            setEditValue(displayExpression);
        } else {
            setEditValue(formatLocaleNumber(displayValue, locale ?? undefined));
        }
        setEditDescription(displayDescription ?? '');
        setShowDescriptionInput(!!displayDescription);
        setEditingField('value');
    };

    // Save value change
    const handleValueSave = () => {
        const result = evaluateExpression(editValue, locale ?? undefined);

        let numericValue: number;
        let expressionToSave: string | null = null;

        if (result.valid) {
            numericValue = result.value;
            if (isExpression(editValue.trim())) {
                expressionToSave = editValue.trim();
            }
        } else {
            numericValue = parseLocaleNumber(editValue, locale ?? undefined);
        }

        const descriptionToSave = editDescription.trim() || null;

        if (
            !isNaN(numericValue) && numericValue > 0
            && (numericValue !== displayValue
                || expressionToSave !== displayExpression
                || descriptionToSave !== displayDescription)
        ) {
            setDisplayValue(numericValue);
            setDisplayExpression(expressionToSave);
            setDisplayDescription(descriptionToSave);

            void fetcher.submit(
                {
                    intent: 'update-connection-value',
                    connectionId: connection.id.toString(),
                    value: numericValue.toString(),
                    valueExpression: expressionToSave ?? '',
                    valueDescription: descriptionToSave ?? ''
                },
                { method: 'post' }
            );
        }
        setEditingField(null);
        setShowDescriptionInput(false);
    };

    // Delete connection
    const handleDelete = () => {
        void fetcher.submit(
            {
                intent: 'delete-connection',
                connectionId: connection.id.toString()
            },
            { method: 'post' }
        );
    };

    // Render name
    const renderName = () => {
        if (editingField === 'name') {
            return (
                <input
                    ref={nameInputRef}
                    type='text'
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={handleNameSave}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleNameSave();
                        } else if (e.key === 'Escape') {
                            setEditName(displayName);
                            setEditingField(null);
                        }
                    }}
                    onClick={e => e.stopPropagation()}
                    className='px-1 py-0.5 border border-blue-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-40'
                />
            );
        }

        return (
            <span
                onClick={handleNameClick}
                className='cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded transition-colors text-blue-600 font-medium'
                title='Click to edit'
            >
                {displayName}
            </span>
        );
    };

    // Render value
    const renderValue = () => {
        if (editingField === 'value') {
            return (
                <div className='flex flex-col gap-1' onClick={e => e.stopPropagation()}>
                    <div className='flex items-center gap-1'>
                        <input
                            type='text'
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleValueSave();
                                } else if (e.key === 'Escape') {
                                    setEditingField(null);
                                    setShowDescriptionInput(false);
                                }
                            }}
                            autoFocus
                            placeholder='Value or expression (e.g., 100+50)'
                            className='w-40 px-2 py-0.5 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'
                        />
                        <button
                            type='button'
                            onClick={() => setShowDescriptionInput(!showDescriptionInput)}
                            className={`p-1 rounded hover:bg-gray-200 ${
                                showDescriptionInput || displayDescription ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title={showDescriptionInput ? 'Hide description' : 'Add description'}
                        >
                            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z'
                                />
                            </svg>
                        </button>
                        <button
                            type='button'
                            onClick={handleValueSave}
                            className='p-1 text-green-600 hover:bg-green-100 rounded'
                            title='Save'
                        >
                            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
                            </svg>
                        </button>
                    </div>
                    {showDescriptionInput && (
                        <input
                            type='text'
                            value={editDescription}
                            onChange={e => setEditDescription(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleValueSave();
                                } else if (e.key === 'Escape') {
                                    setEditingField(null);
                                    setShowDescriptionInput(false);
                                }
                            }}
                            placeholder='Description (optional)'
                            className='w-full px-2 py-0.5 border border-gray-300 rounded text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500'
                        />
                    )}
                </div>
            );
        }

        // Build tooltip
        const tooltipParts: string[] = [ 'Click to edit' ];
        if (displayExpression) {
            tooltipParts.push(`Expression: ${displayExpression}`);
        }
        if (displayDescription) {
            tooltipParts.push(`Note: ${displayDescription}`);
        }

        return (
            <span
                onClick={handleValueClick}
                className='text-gray-600 font-mono text-sm w-24 text-right flex items-center justify-end gap-1 cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded transition-colors'
                title={tooltipParts.join('\n')}
            >
                {(displayExpression || displayDescription) && (
                    <svg className='w-3 h-3 text-blue-400 flex-shrink-0' fill='currentColor' viewBox='0 0 20 20'>
                        <path
                            fillRule='evenodd'
                            d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
                            clipRule='evenodd'
                        />
                    </svg>
                )}
                {formatLocaleNumber(displayValue, locale ?? undefined)}
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
            <div className='flex-1 flex items-center gap-2'>{renderName()}</div>
            {renderValue()}
            <button
                type='button'
                onClick={handleDelete}
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
