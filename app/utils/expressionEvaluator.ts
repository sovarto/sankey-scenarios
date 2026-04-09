/**
 * Simple arithmetic expression evaluator with locale-aware number parsing.
 *
 * Supports:
 * - Basic arithmetic: +, -, *, /
 * - Parentheses for grouping
 * - Locale-aware number parsing (e.g., "1.234,56" for German)
 * - Percentage suffix (e.g., "50%" is stored as-is, not converted)
 *
 * Examples:
 * - "100 + 50" → 150
 * - "1000 * 0.5" → 500
 * - "(100 + 200) / 3" → 100
 * - "1.234,56 + 100" (German locale) → 1334.56
 */

import { parseLocaleNumber } from '~/utils/numberUtils';

export interface ExpressionResult {
    /** Whether the expression is valid */
    valid: boolean;
    /** The calculated numeric value (NaN if invalid) */
    value: number;
    /** Error message if invalid */
    error?: string;
    /** Whether the expression contains a percentage suffix */
    isPercent: boolean;
}

/** Tokenize an expression string */
function tokenize(
    expression: string,
    locale?: string,
): Array<{ type: 'number' | 'operator' | 'paren'; value: string | number }> {
    const tokens: Array<{ type: 'number' | 'operator' | 'paren'; value: string | number }> = [];
    let i = 0;
    const expr = expression.trim();

    while (i < expr.length) {
        const char = expr[i];

        // Skip whitespace
        if (/\s/.test(char)) {
            i++;
            continue;
        }

        // Parentheses
        if (char === '(' || char === ')') {
            tokens.push({ type: 'paren', value: char });
            i++;
            continue;
        }

        // Operators
        if (char === '+' || char === '*' || char === '/') {
            tokens.push({ type: 'operator', value: char });
            i++;
            continue;
        }

        // Handle minus - could be operator or negative number
        if (char === '-') {
            // Check if this is a negative number (after operator, paren, or at start)
            const prevToken = tokens[tokens.length - 1];
            const isNegativeNumber = !prevToken
                || prevToken.type === 'operator'
                || (prevToken.type === 'paren' && prevToken.value === '(');

            if (isNegativeNumber) {
                // Part of a number, continue to number parsing
            } else {
                tokens.push({ type: 'operator', value: char });
                i++;
                continue;
            }
        }

        // Number (including locale-specific formats)
        // Numbers can contain: digits, comma, period, minus (for negative)
        let numStr = '';
        const startI = i;

        // Handle leading minus for negative numbers
        if (expr[i] === '-') {
            numStr += '-';
            i++;
        }

        // Collect digits and separators
        while (i < expr.length && /[\d.,\s]/.test(expr[i])) {
            // Don't include trailing space
            if (expr[i] === ' ' && i + 1 < expr.length && !/[\d.,]/.test(expr[i + 1])) {
                break;
            }
            numStr += expr[i];
            i++;
        }

        if (numStr && numStr !== '-') {
            const num = parseLocaleNumber(numStr.trim(), locale);
            if (!isNaN(num)) {
                tokens.push({ type: 'number', value: num });
                continue;
            }
        }

        // If we couldn't parse anything, it's an invalid character
        if (i === startI || (numStr === '-' && i === startI + 1)) {
            throw new Error(`Invalid character at position ${i}: "${expr[i]}"`);
        }
    }

    return tokens;
}

/** Parse and evaluate tokens using recursive descent parser */
function evaluate(tokens: Array<{ type: 'number' | 'operator' | 'paren'; value: string | number }>): number {
    let pos = 0;

    function peek() {
        return tokens[pos];
    }

    function consume() {
        return tokens[pos++];
    }

    // Parse addition and subtraction (lowest precedence)
    function parseAddSub(): number {
        let left = parseMulDiv();

        while (peek() && peek().type === 'operator' && (peek().value === '+' || peek().value === '-')) {
            const op = consume().value;
            const right = parseMulDiv();
            if (op === '+') {
                left = left + right;
            } else {
                left = left - right;
            }
        }

        return left;
    }

    // Parse multiplication and division (higher precedence)
    function parseMulDiv(): number {
        let left = parsePrimary();

        while (peek() && peek().type === 'operator' && (peek().value === '*' || peek().value === '/')) {
            const op = consume().value;
            const right = parsePrimary();
            if (op === '*') {
                left = left * right;
            } else {
                if (right === 0) {
                    throw new Error('Division by zero');
                }
                left = left / right;
            }
        }

        return left;
    }

    // Parse primary expressions (numbers and parenthesized expressions)
    function parsePrimary(): number {
        const token = peek();

        if (!token) {
            throw new Error('Unexpected end of expression');
        }

        if (token.type === 'number') {
            consume();
            return token.value as number;
        }

        if (token.type === 'paren' && token.value === '(') {
            consume(); // consume '('
            const result = parseAddSub();
            const closeParen = consume();
            if (!closeParen || closeParen.type !== 'paren' || closeParen.value !== ')') {
                throw new Error('Missing closing parenthesis');
            }
            return result;
        }

        throw new Error(`Unexpected token: ${token.value}`);
    }

    const result = parseAddSub();

    if (pos < tokens.length) {
        throw new Error(`Unexpected token after expression: ${tokens[pos].value}`);
    }

    return result;
}

/**
 * Evaluate a mathematical expression string.
 *
 * @param expression - The expression to evaluate (e.g., "100 + 50", "1000 * 0.5")
 * @param locale - Optional BCP 47 locale tag for number parsing
 * @returns ExpressionResult with the calculated value or error
 */
export function evaluateExpression(expression: string, locale?: string): ExpressionResult {
    if (!expression || typeof expression !== 'string') {
        return { valid: false, value: NaN, error: 'Empty expression', isPercent: false };
    }

    let expr = expression.trim();

    // Check for percentage suffix
    const percentMatch = expr.match(/^(.+?)(%|p|percent)$/i);
    const isPercent = !!percentMatch;
    if (percentMatch) {
        expr = percentMatch[1].trim();
    }

    // If it's just a simple number, parse it directly
    const simpleNum = parseLocaleNumber(expr, locale);
    if (!isNaN(simpleNum) && !/[+\-*/()]/.test(expr.replace(/^-/, ''))) {
        return { valid: true, value: simpleNum, isPercent };
    }

    try {
        const tokens = tokenize(expr, locale);
        if (tokens.length === 0) {
            return { valid: false, value: NaN, error: 'Empty expression', isPercent };
        }

        const result = evaluate(tokens);
        if (isNaN(result) || !isFinite(result)) {
            return { valid: false, value: NaN, error: 'Invalid result', isPercent };
        }

        return { valid: true, value: result, isPercent };
    } catch (error) {
        return {
            valid: false,
            value: NaN,
            error: error instanceof Error ? error.message : 'Invalid expression',
            isPercent
        };
    }
}

/**
 * Check if a string is a simple number or contains an expression.
 */
export function isExpression(value: string): boolean {
    if (!value) {
        return false;
    }
    // Remove percentage suffix for checking
    const expr = value.replace(/(%|p|percent)$/i, '').trim();
    // Check for operators (but not just a leading minus)
    return /[+*/]/.test(expr) || /[^-]\-/.test(expr) || /\(/.test(expr);
}

/**
 * Format a value for display, showing the expression if present.
 * If the value is a simple number, returns it formatted.
 * If the value is an expression, returns "result (= expression)".
 */
export function formatValueWithExpression(
    value: number,
    expression: string | null | undefined,
    locale?: string,
): string {
    if (!expression || !isExpression(expression)) {
        return value.toString();
    }
    return `${value} (= ${expression})`;
}
