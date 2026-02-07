import { useState, useRef, useEffect } from 'react';
import { useFetcher } from 'react-router';

export function InlineEditableText({
    value,
    name,
    placeholder,
    className,
    inputClassName,
    as: Component = 'span',
}: {
    value: string;
    name: string;
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    as?: 'span' | 'h1' | 'p';
}) {
    const [ isEditing, setIsEditing ] = useState(false);
    const [ text, setText ] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);
    const fetcher = useFetcher();

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [ isEditing ]);

    const handleBlur = () => {
        setIsEditing(false);
        if (text !== value) {
            void fetcher.submit(
                { intent: `update-${name}`, [name]: text },
                { method: 'post' }
            );
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleBlur();
        }
        if (e.key === 'Escape') {
            setText(value);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type='text'
                value={text}
                onChange={e => setText(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className={`bg-transparent border-b-2 border-blue-500 outline-none ${inputClassName}`}
            />
        );
    }

    return (
        <Component
            onClick={() => setIsEditing(true)}
            className={`cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 ${className}`}
            title='Click to edit'
        >
            {value || <span className='text-gray-400 italic'>{placeholder}</span>}
        </Component>
    );
}
