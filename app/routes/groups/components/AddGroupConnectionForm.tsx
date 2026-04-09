import { useState } from 'react';
import { useFetcher } from 'react-router';
import { evaluateExpression, isExpression } from '~/utils/expressionEvaluator';
import { parseLocaleNumber } from '~/utils/numberUtils';

export function AddGroupConnectionForm({
    locale,
}: {
    locale?: string | null;
}) {
    const [ name, setName ] = useState('');
    const [ value, setValue ] = useState('');
    const fetcher = useFetcher();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedName = name.trim();
        if (!trimmedName || !value.trim()) {
            return;
        }

        // Try to evaluate as an expression first
        const result = evaluateExpression(value, locale ?? undefined);

        let numericValue: number;
        let expressionToSave: string | null = null;

        if (result.valid) {
            numericValue = result.value;
            if (isExpression(value.trim())) {
                expressionToSave = value.trim();
            }
        } else {
            numericValue = parseLocaleNumber(value, locale ?? undefined);
        }

        if (isNaN(numericValue) || numericValue <= 0) {
            return;
        }

        void fetcher.submit(
            {
                intent: 'add-connection',
                node: trimmedName,
                value: numericValue.toString(),
                valueExpression: expressionToSave ?? ''
            },
            { method: 'post' }
        );

        setName('');
        setValue('');
    };

    return (
        <form onSubmit={handleSubmit} className='flex items-end gap-3 p-4 bg-gray-50 rounded-md'>
            <div className='flex-1'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Node Name</label>
                <input
                    type='text'
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder='e.g., Taxes'
                    className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500'
                />
            </div>
            <div className='w-48'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Value</label>
                <input
                    type='text'
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder='e.g., 450 or 100+350'
                    className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500'
                />
            </div>
            <button
                type='submit'
                disabled={!name.trim() || !value.trim()}
                className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed'
            >
                Add
            </button>
        </form>
    );
}
