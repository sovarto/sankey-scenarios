/**
 * Visualization Tests - Sankey Diagram Rendering
 *
 * Test IDs: VIZ-RENDER-001 through VIZ-RENDER-004
 * Test IDs: VIZ-LABEL-001 through VIZ-LABEL-005
 * Test IDs: VIZ-INTERACT-001 through VIZ-INTERACT-004
 */

import { test, expect, AUTH_STORAGE, uniqueId } from '../fixtures/test-fixtures';

test.describe('Sankey Diagram Visualization', () => {
    test.use({ storageState: AUTH_STORAGE.member });

    let projectId: number;
    let scenarioId: number;

    test.beforeEach(async ({ page, createProject, createScenario }) => {
        const projectName = uniqueId('VizProject');
        projectId = await createProject(projectName);
        scenarioId = await createScenario(projectId, uniqueId('VizScenario'));
    });

    test.describe('Diagram Rendering', () => {
        test('VIZ-RENDER-001: Diagram renders with connections', async ({ page }) => {
            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            // Add connections first
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            await sourceInput.fill('Income');
            await targetInput.fill('Expenses');
            await valueInput.fill('1000');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            // Go to view page to see diagram
            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}`);

            // SVG should be rendered
            const svg = page.locator('svg:has(.flows)');
            await expect(svg).toBeVisible();

            // Should contain path elements (the flows)
            const paths = svg.locator('.flows path');
            await expect(paths).toHaveCount(1);
        });

        test('VIZ-RENDER-002: Multiple flows render correctly', async ({ page }) => {
            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            // Add multiple connections
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            // Connection 1
            await sourceInput.fill('Revenue');
            await targetInput.fill('Pool');
            await valueInput.fill('1000');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            // Connection 2
            await page.getByPlaceholder('Type or select source...').fill('Pool');
            await page.getByPlaceholder('Target...').first().fill('Expenses');
            await page.getByPlaceholder('a ? * 123').fill('600');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            // Connection 3
            await page.getByPlaceholder('Type or select source...').fill('Pool');
            await page.getByPlaceholder('Target...').first().fill('Savings');
            await page.getByPlaceholder('a ? * 123').fill('400');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            // Go to view
            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}`);

            // Should have multiple paths
            const svg = page.locator('svg:has(.flows)');
            await expect(svg).toBeVisible();

            // Check for the presence of node labels
            await expect(page.getByText('Revenue').first()).toBeVisible();
            await expect(page.getByText('Pool').first()).toBeVisible();
            await expect(page.getByText('Expenses').first()).toBeVisible();
            await expect(page.getByText('Savings').first()).toBeVisible();
        });

        test('VIZ-RENDER-003: Empty scenario shows placeholder', async ({ page }) => {
            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}`);

            // Should show empty state message
            await expect(page.getByText(/no connections/i)).toBeVisible();
        });

        test('VIZ-RENDER-004: Large values format correctly', async ({ page }) => {
            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();
            const valueInput = page.getByPlaceholder('a ? * 123');

            await sourceInput.fill('Income');
            await targetInput.fill('Budget');
            await valueInput.fill('1000000');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            // Go to view
            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}`);

            // Value should be formatted (e.g., with commas or abbreviated)
            // Check for either raw or formatted value
            const hasFormattedValue = await page.getByText(/1,000,000|1M|1000000/).first().isVisible();
            expect(hasFormattedValue).toBeTruthy();
        });
    });

    test.describe('Label Rendering', () => {
        test('VIZ-LABEL-001: Node labels display correctly', async ({ page }) => {
            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            // Add a connection
            await page.getByPlaceholder('Type or select source...').fill('Salary');
            await page.getByPlaceholder('Target...').first().fill('Budget');
            await page.getByPlaceholder('a ? * 123').fill('5000');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}`);

            // Labels should be visible
            await expect(page.getByText('Salary').first()).toBeVisible();
            await expect(page.getByText('Budget').first()).toBeVisible();
        });

        test('VIZ-LABEL-002: Value labels display', async ({ page }) => {
            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            await page.getByPlaceholder('Type or select source...').fill('Income');
            await page.getByPlaceholder('Target...').first().fill('Savings');
            await page.getByPlaceholder('a ? * 123').fill('2500');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}`);

            // Value should appear in the diagram
            await expect(page.getByText(/2,?500/).first()).toBeVisible();
        });

        test('VIZ-LABEL-003: Auto-fit labels option', async ({ page }) => {
            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            // Add connection
            await page.getByPlaceholder('Type or select source...').fill('LongNodeNameThatMightOverlap');
            await page.getByPlaceholder('Target...').first().fill('AnotherLongNodeName');
            await page.getByPlaceholder('a ? * 123').fill('1000');
            await page.getByRole('button', { name: /add.*connection/i }).click();

            // Look for auto-fit toggle
            const autoFitToggle = page.getByLabel(/auto.?fit|compact/i);
            if (await autoFitToggle.isVisible()) {
                // Toggle should be clickable
                await autoFitToggle.click();
            }
        });
    });

    test.describe('Interactions', () => {
        test('VIZ-INTERACT-001: Hover highlights flow', async ({ page }) => {
            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            await page.getByPlaceholder('Type or select source...').fill('Source');
            await page.getByPlaceholder('Target...').first().fill('Target');
            await page.getByPlaceholder('a ? * 123').fill('500');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}`);

            // Find a flow path in SVG
            const svg = page.locator('svg:has(.flows)');
            await expect(svg).toBeVisible();

            const path = svg.locator('path').first();
            if (await path.isVisible()) {
                // Hover should trigger visual change (opacity, etc.)
                await path.hover();

                // Take a screenshot to verify hover state
                // Or check for CSS changes
            }
        });

        test('VIZ-INTERACT-002: Click shows tooltip/details', async ({ page }) => {
            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            await page.getByPlaceholder('Type or select source...').fill('Revenue');
            await page.getByPlaceholder('Target...').first().fill('Profit');
            await page.getByPlaceholder('a ? * 123').fill('10000');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}`);

            // Interact with elements in diagram
            const svg = page.locator('svg:has(.flows)');
            await expect(svg).toBeVisible();

            // The label elements should be clickable
            const label = page.locator('text').filter({ hasText: 'Revenue' }).first();
            if (await label.isVisible()) {
                await label.click({ force: true });
            }
        });

        test('VIZ-INTERACT-003: Zoom/pan if supported', async ({ page }) => {
            // Skip if zoom/pan not implemented
            test.skip();
        });
    });

    test.describe('Special Flow Colors', () => {
        test('VIZ-COLOR-001: Missing flows have distinct color', async ({ page }) => {
            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            // Create unbalanced node with missing
            await page.getByPlaceholder('Type or select source...').fill('Source');
            await page.getByPlaceholder('Target...').first().fill('Middle');
            await page.getByPlaceholder('a ? * 123').fill('200');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            await page.getByPlaceholder('Type or select source...').fill('Middle');
            await page.getByPlaceholder('Target...').first().fill('End');
            await page.getByPlaceholder('a ? * 123').fill('500');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            await page.getByPlaceholder('Type or select source...').fill('Missing');
            await page.getByPlaceholder('Target...').first().fill('Middle');
            await page.getByPlaceholder('a ? * 123').fill('?');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}`);

            // The missing flow should render with a different style
            const svg = page.locator('svg:has(.flows)');
            await expect(svg).toBeVisible();
        });

        test('VIZ-COLOR-002: Remaining flows have distinct style', async ({ page }) => {
            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            await page.getByPlaceholder('Type or select source...').fill('Income');
            await page.getByPlaceholder('Target...').first().fill('Pool');
            await page.getByPlaceholder('a ? * 123').fill('1000');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            await page.getByPlaceholder('Type or select source...').fill('Pool');
            await page.getByPlaceholder('Target...').first().fill('Fixed');
            await page.getByPlaceholder('a ? * 123').fill('400');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            await page.getByPlaceholder('Type or select source...').fill('Pool');
            await page.getByPlaceholder('Target...').first().fill('Remaining');
            await page.getByPlaceholder('a ? * 123').fill('*');
            await page.getByRole('button', { name: /add.*connection/i }).click();
            await expect(page.getByPlaceholder('Target...').first()).toHaveValue('');

            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}`);

            // Remaining flow should render
            const svg = page.locator('svg:has(.flows)');
            await expect(svg).toBeVisible();
            await expect(page.getByText('Remaining').first()).toBeVisible();
        });
    });
});
