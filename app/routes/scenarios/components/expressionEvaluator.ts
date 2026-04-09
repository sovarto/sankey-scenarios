export { evaluateExpression, isExpression } from '~/utils/expressionEvaluator';
export type { ExpressionResult } from '~/utils/expressionEvaluator';

import { isExpression } from '~/utils/expressionEvaluator';

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
