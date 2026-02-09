import { useState, useRef, useEffect, useMemo } from 'react';
import type { ComboboxOption } from './types';

export function NodeCombobox({
    value,
    onChange,
    onSelect,
    options,
    placeholder,
    disabled,
    onCancel,
    autoFocus = false,
}: {
    value: ComboboxOption | null;
    onChange: (option: ComboboxOption | null) => void;
    onSelect?: (option: ComboboxOption) => void;
    options: ComboboxOption[];
    placeholder?: string;
    disabled?: boolean;
    onCancel?: () => void;
    autoFocus?: boolean;
}) {
    const [ inputValue, setInputValue ] = useState(value?.name ?? '');
    const [ isOpen, setIsOpen ] = useState(false);
    const [ highlightedIndex, setHighlightedIndex ] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    // Filter options based on input
    const filteredOptions = useMemo(() => {
        const search = inputValue.toLowerCase();
        return options.filter(opt => opt.display.toLowerCase().includes(search));
    }, [ options, inputValue ]);

    // Group filtered options by type
    const groupedOptions = useMemo(() => {
        const nodeRefs = filteredOptions.filter(o => o.type === 'node');
        const groupRefs = filteredOptions.filter(o => o.type === 'group');
        const locals = filteredOptions.filter(o => o.type === 'local');
        return { nodeRefs, groupRefs, locals };
    }, [ filteredOptions ]);

    // Flat list for keyboard navigation
    const flatOptions = useMemo(
        () => [ ...groupedOptions.nodeRefs, ...groupedOptions.groupRefs, ...groupedOptions.locals ],
        [ groupedOptions ]
    );

    useEffect(() => {
        setHighlightedIndex(0);
    }, [ inputValue ]);

    // Sync input value when external value changes
    useEffect(() => {
        setInputValue(value?.name ?? '');
    }, [ value ]);

    // Auto-focus and select all text on mount if requested
    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [ autoFocus ]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        setIsOpen(true);

        // If typing new text, create a local option
        if (newValue.trim()) {
            const existingOption = options.find(
                o => o.name.toLowerCase() === newValue.toLowerCase()
            );
            if (existingOption) {
                onChange(existingOption);
            } else {
                onChange({
                    type: 'local',
                    name: newValue,
                    display: `Local: ${newValue}`
                });
            }
        } else {
            onChange(null);
        }
    };

    const handleSelect = (option: ComboboxOption) => {
        setInputValue(option.name);
        onChange(option);
        onSelect?.(option);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                setIsOpen(true);
                e.preventDefault();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(i => Math.min(i + 1, flatOptions.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (flatOptions[highlightedIndex]) {
                    handleSelect(flatOptions[highlightedIndex]);
                } else if (inputValue.trim()) {
                    // Create a new local node with the typed name
                    const newLocalOption: ComboboxOption = {
                        type: 'local',
                        name: inputValue.trim(),
                        display: `Local: ${inputValue.trim()}`
                    };
                    handleSelect(newLocalOption);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                onCancel?.();
                break;
        }
    };

    const handleBlur = () => {
        // Delay closing to allow click on option
        setTimeout(() => {
            if (!listRef.current?.contains(document.activeElement)) {
                setIsOpen(false);
            }
        }, 150);
    };

    return (
        <div className='relative'>
            <input
                ref={inputRef}
                type='text'
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => setIsOpen(true)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900'
            />
            {isOpen && flatOptions.length > 0 && (
                <ul
                    ref={listRef}
                    className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto'
                >
                    {groupedOptions.nodeRefs.length > 0 && (
                        <>
                            <li className='px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50'>
                                Node References
                            </li>
                            {groupedOptions.nodeRefs.map((opt, idx) => {
                                const flatIdx = idx;
                                return (
                                    <li
                                        key={`node-${opt.id}`}
                                        onClick={() => handleSelect(opt)}
                                        className={`px-3 py-2 cursor-pointer text-sm ${
                                            flatIdx === highlightedIndex
                                                ? 'bg-blue-100 text-blue-900'
                                                : 'text-gray-900 hover:bg-gray-100'
                                        }`}
                                    >
                                        <span className='text-purple-600'>{opt.name}</span>
                                        <span className='text-gray-400 ml-2'>({opt.value})</span>
                                    </li>
                                );
                            })}
                        </>
                    )}
                    {groupedOptions.groupRefs.length > 0 && (
                        <>
                            <li className='px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50'>
                                Group References
                            </li>
                            {groupedOptions.groupRefs.map((opt, idx) => {
                                const flatIdx = groupedOptions.nodeRefs.length + idx;
                                return (
                                    <li
                                        key={`group-${opt.id}`}
                                        onClick={() => handleSelect(opt)}
                                        className={`px-3 py-2 cursor-pointer text-sm ${
                                            flatIdx === highlightedIndex
                                                ? 'bg-blue-100 text-blue-900'
                                                : 'text-gray-900 hover:bg-gray-100'
                                        }`}
                                    >
                                        <span className='text-green-600'>[{opt.name}]</span>
                                    </li>
                                );
                            })}
                        </>
                    )}
                    {groupedOptions.locals.length > 0 && (
                        <>
                            <li className='px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50'>Local Nodes</li>
                            {groupedOptions.locals.map((opt, idx) => {
                                const flatIdx = groupedOptions.nodeRefs.length + groupedOptions.groupRefs.length + idx;
                                return (
                                    <li
                                        key={`local-${opt.name}`}
                                        onClick={() => handleSelect(opt)}
                                        className={`px-3 py-2 cursor-pointer text-sm ${
                                            flatIdx === highlightedIndex
                                                ? 'bg-blue-100 text-blue-900'
                                                : 'text-gray-900 hover:bg-gray-100'
                                        }`}
                                    >
                                        {opt.name}
                                    </li>
                                );
                            })}
                        </>
                    )}
                </ul>
            )}
        </div>
    );
}
