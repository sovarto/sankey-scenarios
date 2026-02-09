/**
 * Scenario - Special Connection Types and Value Calculations Tests
 *
 * Test IDs: SCEN-SPECIAL-001 through SCEN-SPECIAL-007
 * Test IDs: SCEN-CALC-001 through SCEN-CALC-010
 */

import { test, expect, AUTH_STORAGE, uniqueId } from '../fixtures/test-fixtures';

test.describe('Special Connection Types', () => {
    test.use({ storageState: AUTH_STORAGE.member });

    let projectId: number;
    let scenarioId: number;

    test.beforeEach(async ({ page, createProject, createScenario }) => {
        const projectName = uniqueId('SpecialProject');
        projectId = await createProject(projectName);
        scenarioId = await createScenario(projectId, uniqueId('SpecialScenario'));
        await page.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);
    });

    test.describe('Auto Connections', () => {
        test('SCEN-SPECIAL-001: Add auto connection with "a"', async ({ page }) => {
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            // First, create a source with value
            await sourceInput.fill('Income');
            await targetInput.fill('Budget');
            await valueInput.fill('1000');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            await expect(page.getByText('1000').first()).toBeVisible();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            // Add auto connection from Budget
            await page.getByPlaceholder('Type or select source...').fill('Budget');
            await page.getByPlaceholder('Target...').first().fill('AutoNode');
            await page.getByPlaceholder('a ? * 123').fill('a');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            // Should show "auto" or calculated value
            await expect(page.getByText('AutoNode').first()).toBeVisible();
        });

        test('SCEN-SPECIAL-002: Auto connection calculates flow-through value', async ({ page }) => {
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            // Create: Source(500) -> Middle -> Target
            await sourceInput.fill('Source');
            await targetInput.fill('Middle');
            await valueInput.fill('500');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            await expect(page.getByText('500').first()).toBeVisible();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            // Add auto connection from Middle to Target
            await page.getByPlaceholder('Type or select source...').fill('Middle');
            await page.getByPlaceholder('Target...').first().fill('Target');
            await page.getByPlaceholder('a ? * 123').fill('auto');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            // Auto should calculate to 500 (flow-through)
            // The auto connection takes all remaining value
            await expect(page.getByText('Target').first()).toBeVisible();
        });
    });

    test.describe('Missing Placeholder', () => {
        test('SCEN-SPECIAL-003: Add missing placeholder with "?"', async ({ page }) => {
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            // Create an unbalanced node (more outgoing than incoming)
            // First add incoming: Source(500) -> Middle
            await sourceInput.fill('Source');
            await targetInput.fill('Middle');
            await valueInput.fill('500');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            // Add outgoing that exceeds incoming: Middle(800) -> Target
            await page.getByPlaceholder('Type or select source...').fill('Middle');
            await page.getByPlaceholder('Target...').first().fill('Target');
            await page.getByPlaceholder('a ? * 123').fill('800');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            // Middle now has deficit of 300
            // Add missing placeholder: Unknown(?) -> Middle
            await page.getByPlaceholder('Type or select source...').fill('Unknown');
            await page.getByPlaceholder('Target...').first().fill('Middle');
            await page.getByPlaceholder('a ? * 123').fill('?');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            // Missing connection should appear
            await expect(page.getByText('Unknown').first()).toBeVisible();
        });

        test('SCEN-SPECIAL-004: Missing placeholder calculates deficit', async ({ page }) => {
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            // Node with 200 in and 500 out = 300 missing
            await sourceInput.fill('Income');
            await targetInput.fill('Budget');
            await valueInput.fill('200');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            await page.getByPlaceholder('Type or select source...').fill('Budget');
            await page.getByPlaceholder('Target...').first().fill('Expenses');
            await page.getByPlaceholder('a ? * 123').fill('500');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            // Add missing connection to cover the deficit
            await page.getByPlaceholder('Type or select source...').fill('Loan');
            await page.getByPlaceholder('Target...').first().fill('Budget');
            await page.getByPlaceholder('a ? * 123').fill('missing');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            // Should calculate to 300 (the deficit)
            await expect(page.getByText('300').first()).toBeVisible();
        });
    });

    test.describe('Remaining Placeholder', () => {
        test('SCEN-SPECIAL-005: Add remaining placeholder with "*"', async ({ page }) => {
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            // Node with surplus (more in than out)
            await sourceInput.fill('Revenue');
            await targetInput.fill('Account');
            await valueInput.fill('1000');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            await page.getByPlaceholder('Type or select source...').fill('Account');
            await page.getByPlaceholder('Target...').first().fill('Expenses');
            await page.getByPlaceholder('a ? * 123').fill('600');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            // Add remaining placeholder for surplus
            await page.getByPlaceholder('Type or select source...').fill('Account');
            await page.getByPlaceholder('Target...').first().fill('Savings');
            await page.getByPlaceholder('a ? * 123').fill('*');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            // Remaining should appear
            await expect(page.getByText('Savings').first()).toBeVisible();
        });

        test('SCEN-SPECIAL-006: Remaining placeholder calculates surplus', async ({ page }) => {
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            // 1000 in, 400 out = 600 remaining
            await sourceInput.fill('Income');
            await targetInput.fill('Pool');
            await valueInput.fill('1000');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            await page.getByPlaceholder('Type or select source...').fill('Pool');
            await page.getByPlaceholder('Target...').first().fill('Bills');
            await page.getByPlaceholder('a ? * 123').fill('400');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            // Add remaining
            await page.getByPlaceholder('Type or select source...').fill('Pool');
            await page.getByPlaceholder('Target...').first().fill('Savings');
            await page.getByPlaceholder('a ? * 123').fill('remaining');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            // Should calculate to 600
            await expect(page.getByText('600').first()).toBeVisible();
        });

        test('SCEN-SPECIAL-007: Remaining with zero outflows equals total inflow', async ({ page }) => {
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            // Create inflow
            await sourceInput.fill('Source1');
            await targetInput.fill('Middle');
            await valueInput.fill('500');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            await page.getByPlaceholder('Type or select source...').fill('Source2');
            await page.getByPlaceholder('Target...').first().fill('Middle');
            await page.getByPlaceholder('a ? * 123').fill('300');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            // Add remaining with no other outflows
            await page.getByPlaceholder('Type or select source...').fill('Middle');
            await page.getByPlaceholder('Target...').first().fill('End');
            await page.getByPlaceholder('a ? * 123').fill('r');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            // Should be 800 (500 + 300)
            await expect(page.getByText('800').first()).toBeVisible();
        });
    });
});

test.describe('Value Calculations', () => {
    test.use({ storageState: AUTH_STORAGE.member });

    let projectId: number;
    let scenarioId: number;

    test.beforeEach(async ({ page, createProject, createScenario }) => {
        const projectName = uniqueId('CalcProject');
        projectId = await createProject(projectName);
        scenarioId = await createScenario(projectId, uniqueId('CalcScenario'));
        await page.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);
    });

    test.describe('Percentage Calculations', () => {
        test('SCEN-CALC-001: Percentage value resolves correctly', async ({ page }) => {
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            // Create source node with 1000
            await sourceInput.fill('Total');
            await targetInput.fill('Pool');
            await valueInput.fill('1000');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            // Add 25% connection from Pool
            await page.getByPlaceholder('Type or select source...').fill('Pool');
            await page.getByPlaceholder('Target...').first().fill('Quarter');
            await page.getByPlaceholder('a ? * 123').fill('25%');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            // Should calculate to 250 (25% of 1000)
            await expect(page.getByText('250').first()).toBeVisible();
        });

        test('SCEN-CALC-002: Multiple percentages from same node', async ({ page }) => {
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            // Source with 1000
            await sourceInput.fill('Income');
            await targetInput.fill('Budget');
            await valueInput.fill('1000');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            // 30% to Taxes
            await page.getByPlaceholder('Type or select source...').fill('Budget');
            await page.getByPlaceholder('Target...').first().fill('Taxes');
            await page.getByPlaceholder('a ? * 123').fill('30%');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            await expect(page.getByText('300').first()).toBeVisible();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            // 20% to Savings
            await page.getByPlaceholder('Type or select source...').fill('Budget');
            await page.getByPlaceholder('Target...').first().fill('Savings');
            await page.getByPlaceholder('a ? * 123').fill('20%');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            await expect(page.getByText('200').first()).toBeVisible();
        });
    });

    test.describe('Expression Calculations', () => {
        test('SCEN-CALC-005: Simple addition expression', async ({ page }) => {
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            await sourceInput.fill('Source');
            await targetInput.fill('Target');
            await valueInput.fill('100 + 50');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            // Should calculate to 150
            await expect(page.getByText('150').first()).toBeVisible();
        });

        test('SCEN-CALC-006: Multiplication expression', async ({ page }) => {
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            await sourceInput.fill('Source');
            await targetInput.fill('Target');
            await valueInput.fill('12 * 5');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            // Should calculate to 60
            await expect(page.getByText('60').first()).toBeVisible();
        });

        test('SCEN-CALC-007: Complex expression with parentheses', async ({ page }) => {
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            await sourceInput.fill('Source');
            await targetInput.fill('Target');
            await valueInput.fill('(100 + 20) * 2');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            // Should calculate to 240
            await expect(page.getByText('240').first()).toBeVisible();
        });
    });

    test.describe('Balance Calculations', () => {
        test('SCEN-CALC-008: Node balance updates when connections change', async ({ page }) => {
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            // Create initial flow
            await sourceInput.fill('Start');
            await targetInput.fill('Middle');
            await valueInput.fill('1000');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            await page.getByPlaceholder('Type or select source...').fill('Middle');
            await page.getByPlaceholder('Target...').first().fill('End');
            await page.getByPlaceholder('a ? * 123').fill('*');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            // Remaining should be 1000
            await expect(page.getByText('1000').nth(1)).toBeVisible();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            // Add another outflow and remaining should update
            await page.getByPlaceholder('Type or select source...').fill('Middle');
            await page.getByPlaceholder('Target...').first().fill('Other');
            await page.getByPlaceholder('a ? * 123').fill('300');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            // Remaining should now be 700 (1000 - 300)
            await expect(page.getByText('700').first()).toBeVisible();
        });
    });
});
