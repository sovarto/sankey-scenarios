/**
 * Locale-aware number parsing utilities
 *
 * Supports both explicit locale and heuristic-based parsing.
 */

/**
 * Get the decimal and thousands separators for a given locale.
 */
export function getLocaleSeparators(locale: string): { decimal: string; thousands: string } {
    try {
        const parts = new Intl.NumberFormat(locale).formatToParts(1234.5);
        const decimal = parts.find(p => p.type === 'decimal')?.value || '.';
        const thousands = parts.find(p => p.type === 'group')?.value || ',';
        return { decimal, thousands };
    } catch {
        return { decimal: '.', thousands: ',' };
    }
}

/**
 * Parse a number string according to a specific locale.
 * If no locale is provided, uses heuristics to determine format.
 *
 * @param value - The string to parse
 * @param locale - BCP 47 locale tag (e.g., 'de-DE', 'en-US')
 */
export function parseLocaleNumber(value: string, locale?: string): number {
    if (!value || typeof value !== 'string') {
        return NaN;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return NaN;
    }

    // Remove any spaces (some locales use space as thousands separator)
    let normalized = trimmed.replace(/\s/g, '');

    // If locale is provided, use locale-specific parsing
    if (locale) {
        const { decimal, thousands } = getLocaleSeparators(locale);

        // Remove thousands separators
        if (thousands) {
            normalized = normalized.split(thousands).join('');
        }

        // Replace decimal separator with period
        if (decimal && decimal !== '.') {
            normalized = normalized.replace(decimal, '.');
        }

        return parseFloat(normalized);
    }

    // Heuristic-based parsing when no locale is provided
    const hasComma = normalized.includes(',');
    const hasPeriod = normalized.includes('.');

    if (hasComma && hasPeriod) {
        // Both separators present - the last one is the decimal separator
        const lastComma = normalized.lastIndexOf(',');
        const lastPeriod = normalized.lastIndexOf('.');

        if (lastComma > lastPeriod) {
            // European format: 1.234,56
            normalized = normalized.replace(/\./g, '').replace(',', '.');
        } else {
            // US format: 1,234.56
            normalized = normalized.replace(/,/g, '');
        }
    } else if (hasComma) {
        // Only comma - determine if it's decimal or thousands separator
        const parts = normalized.split(',');
        const afterComma = parts[parts.length - 1];

        // If 1-2 digits after comma, or multiple commas, treat comma as decimal
        // If exactly 3 digits after single comma, it's ambiguous - treat as decimal for European users
        if (parts.length === 2 && afterComma.length <= 2) {
            // Likely decimal: 81,12 -> 81.12
            normalized = normalized.replace(',', '.');
        } else if (parts.length === 2 && afterComma.length === 3 && parts[0].length <= 3) {
            // Ambiguous case like "123,456" - could be 123.456 or 123456
            // Treat as decimal for European format since that's less common in English
            normalized = normalized.replace(',', '.');
        } else if (parts.length > 2 || (parts.length === 2 && afterComma.length === 3 && parts[0].length > 3)) {
            // Multiple commas or pattern like "1,234,567" - thousands separator
            normalized = normalized.replace(/,/g, '');
        } else {
            // Default: treat comma as decimal separator
            normalized = normalized.replace(',', '.');
        }
    } else if (hasPeriod) {
        // Only period - determine if it's decimal or thousands separator
        const parts = normalized.split('.');
        const afterPeriod = parts[parts.length - 1];

        if (parts.length > 2 || (parts.length === 2 && afterPeriod.length === 3 && parts[0].length > 3)) {
            // Multiple periods or pattern like "1.234.567" - thousands separator (European)
            normalized = normalized.replace(/\./g, '');
        }
        // Otherwise keep as-is (period is decimal separator)
    }

    return parseFloat(normalized);
}

/**
 * Format a number for display using a specific locale.
 * @param value - The number to format
 * @param locale - BCP 47 locale tag (e.g., 'de-DE', 'en-US'). If undefined, uses browser default.
 * @param decimals - Optional number of decimal places
 */
export function formatLocaleNumber(value: number, locale?: string, decimals?: number): string {
    if (isNaN(value)) {
        return '';
    }

    try {
        const options: Intl.NumberFormatOptions = {};
        if (decimals !== undefined) {
            options.minimumFractionDigits = decimals;
            options.maximumFractionDigits = decimals;
        }
        return new Intl.NumberFormat(locale, options).format(value);
    } catch {
        // Fallback to simple format
        if (decimals !== undefined) {
            return value.toFixed(decimals);
        }
        return value.toString();
    }
}
