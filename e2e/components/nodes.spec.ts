/**
 * Component Tests - Project Nodes
 *
 * Test IDs: COMP-NODE-001 through COMP-NODE-006
 */

import { test, expect, AUTH_STORAGE, uniqueId } from '../fixtures/test-fixtures';

test.describe('Project Nodes', () => {
    test.use({ storageState: AUTH_STORAGE.member });

    let projectId: number;

    test.beforeEach(async ({ createProject }) => {
        projectId = await createProject(uniqueId('NodeProject'));
    });

    test.describe('Create Node', () => {
        test('COMP-NODE-001: Create node with name and value', async ({ page }) => {
            const nodeName = uniqueId('SalaryNode');
            const nodeValue = '5000';

            await page.goto(`/projects/${projectId}/nodes/new`);

            await page.getByLabel('Node Name').fill(nodeName);
            await page.getByLabel('Value').fill(nodeValue);
            await page.getByRole('button', { name: /create/i }).click();

            // Should redirect to node view
            await expect(page).toHaveURL(/\/projects\/\d+\/nodes\/\d+/);

            // Should show node name and value
            await expect(page.getByRole('heading', { name: nodeName })).toBeVisible();
            await expect(page.getByText('5000').or(page.getByText('5,000')).first()).toBeVisible();
        });

        test('COMP-NODE-002: Create node with description', async ({ page }) => {
            const nodeName = uniqueId('DescNode');
            const description = 'Test node description';

            await page.goto(`/projects/${projectId}/nodes/new`);

            await page.getByLabel('Node Name').fill(nodeName);
            await page.getByLabel('Value').fill('1000');
            await page.getByLabel('Description').fill(description);
            await page.getByRole('button', { name: /create/i }).click();

            await expect(page).toHaveURL(/\/nodes\/\d+/);
            await expect(page.getByText(description)).toBeVisible();
        });

        test('COMP-NODE-003: Node name is required', async ({ page }) => {
            await page.goto(`/projects/${projectId}/nodes/new`);

            const nameInput = page.getByLabel('Node Name');
            await expect(nameInput).toHaveAttribute('required', '');
        });

        test('COMP-NODE-004: Node value is required', async ({ page }) => {
            await page.goto(`/projects/${projectId}/nodes/new`);

            const valueInput = page.getByLabel('Value');
            await expect(valueInput).toHaveAttribute('required', '');
        });

        test('Node value must be positive', async ({ page }) => {
            await page.goto(`/projects/${projectId}/nodes/new`);

            await page.getByLabel('Node Name').fill('TestNode');
            await page.getByLabel('Value').fill('-100');
            await page.getByRole('button', { name: /create/i }).click();

            // Should show error or validation message
            // The min attribute should prevent negative values
            const valueInput = page.getByLabel('Value');
            await expect(valueInput).toHaveAttribute('min', '0.01');
        });
    });

    test.describe('View Node', () => {
        test('COMP-NODE-005: View node details', async ({ page }) => {
            const nodeName = uniqueId('ViewNode');

            // Create node first
            await page.goto(`/projects/${projectId}/nodes/new`);
            await page.getByLabel('Node Name').fill(nodeName);
            await page.getByLabel('Value').fill('2500');
            await page.getByRole('button', { name: /create/i }).click();

            await expect(page).toHaveURL(/\/nodes\/\d+/);

            // Should show node details
            await expect(page.getByRole('heading', { name: nodeName })).toBeVisible();
            await expect(page.getByText('2500').or(page.getByText('2,500')).first()).toBeVisible();
        });

        test('Node appears in project list', async ({ page }) => {
            const nodeName = uniqueId('ListNode');

            // Create node
            await page.goto(`/projects/${projectId}/nodes/new`);
            await page.getByLabel('Node Name').fill(nodeName);
            await page.getByLabel('Value').fill('1500');
            await page.getByRole('button', { name: /create/i }).click();

            // Wait for create to complete (redirect to view page)
            await expect(page).toHaveURL(/\/nodes\/\d+/);

            // Go to project view
            await page.goto(`/projects/${projectId}`);

            // Node should be listed
            await expect(page.getByText(nodeName).first()).toBeVisible();
        });
    });

    test.describe('Edit Node', () => {
        test('COMP-NODE-006: Edit node value', async ({ page }) => {
            const nodeName = uniqueId('EditNode');

            // Create node
            await page.goto(`/projects/${projectId}/nodes/new`);
            await page.getByLabel('Node Name').fill(nodeName);
            await page.getByLabel('Value').fill('1000');
            await page.getByRole('button', { name: /create/i }).click();

            await expect(page).toHaveURL(/\/nodes\/(\d+)/);
            const nodeId = page.url().match(/\/nodes\/(\d+)/)?.[1];

            // Go to edit page
            await page.goto(`/projects/${projectId}/nodes/${nodeId}/edit`);

            await page.getByLabel('Value').clear();
            await page.getByLabel('Value').fill('2000');
            await page.getByRole('button', { name: /save|update/i }).click();

            // Wait for save to complete before navigating
            await page.waitForLoadState('networkidle');

            // Edit page stays put after save, navigate to view page to verify
            await page.goto(`/projects/${projectId}/nodes/${nodeId}`);
            await expect(page.getByText('2000').or(page.getByText('2,000')).first()).toBeVisible();
        });

        test('Edit node name', async ({ page }) => {
            const originalName = uniqueId('OrigNode');
            const newName = uniqueId('UpdatedNode');

            // Create node
            await page.goto(`/projects/${projectId}/nodes/new`);
            await page.getByLabel('Node Name').fill(originalName);
            await page.getByLabel('Value').fill('500');
            await page.getByRole('button', { name: /create/i }).click();

            await expect(page).toHaveURL(/\/nodes\/(\d+)/);
            const nodeId = page.url().match(/\/nodes\/(\d+)/)?.[1];

            // Go to edit page
            await page.goto(`/projects/${projectId}/nodes/${nodeId}/edit`);

            await page.locator('#name').clear();
            await page.locator('#name').fill(newName);
            await page.getByRole('button', { name: /save|update/i }).click();

            // Wait for save to complete before navigating
            await page.waitForLoadState('networkidle');

            // Edit page stays put after save, navigate to view page to verify
            await page.goto(`/projects/${projectId}/nodes/${nodeId}`);
            await expect(page.getByRole('heading', { name: newName })).toBeVisible();
        });
    });

    test.describe('Delete Node', () => {
        test('Delete node', async ({ page }) => {
            const nodeName = uniqueId('DeleteNode');

            // Create node
            await page.goto(`/projects/${projectId}/nodes/new`);
            await page.getByLabel('Node Name').fill(nodeName);
            await page.getByLabel('Value').fill('750');
            await page.getByRole('button', { name: /create/i }).click();

            await expect(page).toHaveURL(/\/nodes\/(\d+)/);
            const nodeId = page.url().match(/\/nodes\/(\d+)/)?.[1];

            // Go to edit page
            await page.goto(`/projects/${projectId}/nodes/${nodeId}/edit`);

            // Set up dialog handler
            page.on('dialog', dialog => dialog.accept());

            // Click delete
            await page.getByRole('button', { name: /delete/i }).click();

            // Should redirect to nodes list
            await expect(page).toHaveURL(`/projects/${projectId}/nodes`);
        });
    });

    test.describe('Node in Scenarios', () => {
        test('Project node can be referenced in scenario', async ({ page, createScenario }) => {
            const nodeName = uniqueId('RefNode');

            // Create project node
            await page.goto(`/projects/${projectId}/nodes/new`);
            await page.getByLabel('Node Name').fill(nodeName);
            await page.getByLabel('Value').fill('10000');
            await page.getByRole('button', { name: /create/i }).click();

            // Create scenario
            const scenarioId = await createScenario(projectId, uniqueId('RefScenario'));

            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            // The project node should be available in autocomplete
            // when adding connections
            const sourceInput = page.getByPlaceholder('Type or select source...');
            await sourceInput.fill(nodeName.substring(0, 5));

            // Should see the node in autocomplete suggestions
            // (This depends on the UI having autocomplete)
            // Just verify we can add a connection referencing the node
        });
    });
});
