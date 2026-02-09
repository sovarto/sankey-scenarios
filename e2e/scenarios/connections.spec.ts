/**
 * Scenario - Connection Tests
 *
 * Test IDs: SCEN-CONN-001 through SCEN-CONN-008
 * Test IDs: SCEN-SPECIAL-001 through SCEN-SPECIAL-007
 * Test IDs: SCEN-CALC-001 through SCEN-CALC-010
 */

import { test, expect, AUTH_STORAGE, uniqueId } from '../fixtures/test-fixtures';

test.describe('Scenario Connections', () => {
    test.use({ storageState: AUTH_STORAGE.member });

    let projectId: number;
    let scenarioId: number;

    test.beforeEach(async ({ page, createProject, createScenario }) => {
        // Create fresh project and scenario for each test
        const projectName = uniqueId('ConnProject');
        projectId = await createProject(projectName);
        scenarioId = await createScenario(projectId, uniqueId('ConnScenario'));

        // Navigate to scenario edit page
        await page.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);
    });

    test.describe('Direct Connections', () => {
        test('SCEN-CONN-001: Add connection with absolute value', async ({ page }) => {
            // NodeCombobox inputs are identified by placeholder text
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            await sourceInput.fill('Income');
            await targetInput.fill('Expenses');
            await valueInput.fill('100');

            await page.getByRole('button', { name: /add.*connection/i }).click();

            // Connection should appear in list
            await expect(page.getByText('Income').first()).toBeVisible();
            await expect(page.getByText('Expenses').first()).toBeVisible();
            await expect(page.getByText('100').first()).toBeVisible();
        });

        test('SCEN-CONN-002: Add connection with expression', async ({ page }) => {
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            await sourceInput.fill('Sales');
            await targetInput.fill('Revenue');
            await valueInput.fill('100 + 50');

            await page.getByRole('button', { name: /add.*connection/i }).click();

            // Check that calculated value appears (150)
            await expect(page.getByText('150').first()).toBeVisible();
        });

        test('SCEN-CONN-003: Add connection with percentage', async ({ page }) => {
            // First add a source connection to create incoming flow
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            // Add initial connection
            await sourceInput.fill('Income');
            await targetInput.fill('Budget');
            await valueInput.fill('1000');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByText('1000').first()).toBeVisible();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            // Add percentage connection from Budget
            await page.getByPlaceholder('Type or select source...').fill('Budget');
            await page.getByPlaceholder('Target...').first().fill('Savings');
            await page.getByPlaceholder('a ? * 123').fill('20%');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            // Should show calculated 20% of 1000 = 200
            await expect(page.getByText('200').first()).toBeVisible();
        });
    });

    test.describe('Special Connection Types', () => {
        test('SCEN-SPECIAL-001: Add auto connection', async ({ page }) => {
            // Add a value "auto" or "a" in the value field
            test.skip();
        });

        test('SCEN-SPECIAL-003: Add missing placeholder', async ({ page }) => {
            // Add a value "?" or "missing" in the value field
            test.skip();
        });

        test('SCEN-SPECIAL-005: Add remaining placeholder', async ({ page }) => {
            // Add a value "*" or "remaining" in the value field
            test.skip();
        });
    });

    test.describe('Value Calculations', () => {
        test('SCEN-CALC-001: Percentage calculation resolves correctly', async ({ page }) => {
            // This requires:
            // 1. Add source node with incoming flow (e.g., 1000)
            // 2. Add percentage connection (e.g., 30%)
            // 3. Verify calculated value (300)
            test.skip();
        });

        test('SCEN-CALC-003: Missing placeholder calculates deficit', async ({ page }) => {
            // This requires:
            // 1. Create unbalanced node (more out than in)
            // 2. Add missing placeholder
            // 3. Verify calculated value
            test.skip();
        });

        test('SCEN-CALC-004: Remaining placeholder calculates surplus', async ({ page }) => {
            // This requires:
            // 1. Create unbalanced node (more in than out)
            // 2. Add remaining placeholder
            // 3. Verify calculated value
            test.skip();
        });
    });

    test.describe('CRUD Operations', () => {
        test('SCEN-CONN-005: Delete connection', async ({ page }) => {
            // Assumes a connection exists
            // Find delete button and click
            test.skip();
        });

        test('SCEN-CONN-006: Reorder connections', async ({ page }) => {
            // Drag and drop test
            test.skip();
        });
    });
});

test.describe('Sankey Diagram Rendering', () => {
    test.use({ storageState: AUTH_STORAGE.member });

    test('VIZ-RENDER-001: Diagram renders with connections', async ({ page, createProject, createScenario }) => {
        const projectId = await createProject(uniqueId('VizProject'));
        const scenarioId = await createScenario(projectId, uniqueId('VizScenario'));

        // Navigate to edit page and add a connection
        await page.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);
        await page.getByPlaceholder('Type or select source...').fill('Income');
        await page.getByPlaceholder('Target...').first().fill('Expenses');
        await page.getByPlaceholder('a ? * 123').fill('1000');
        await page.getByRole('button', { name: /add.*connection/i }).click();
        await expect(page.getByText('1000').first()).toBeVisible();

        // Go to view page to see diagram
        await page.goto(`/projects/${projectId}/scenarios/${scenarioId}`);

        // Check for SVG element
        const svg = page.locator('svg:has(.flows)');
        await expect(svg).toBeVisible();
    });

    test('VIZ-RENDER-004: Empty state when no connections', async ({ page, createProject, createScenario }) => {
        const projectId = await createProject(uniqueId('EmptyProject'));
        const scenarioId = await createScenario(projectId, uniqueId('EmptyScenario'));

        await page.goto(`/projects/${projectId}/scenarios/${scenarioId}`);

        // Should show empty state message
        await expect(page.getByText(/no connections/i)).toBeVisible();
    });
});
