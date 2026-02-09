/**
 * Scenario CRUD Tests
 *
 * Test IDs: SCEN-CRUD-001 through SCEN-CRUD-004
 */

import { test, expect, AUTH_STORAGE, uniqueId } from '../fixtures/test-fixtures';

test.describe('Scenario CRUD', () => {
    test.use({ storageState: AUTH_STORAGE.member });

    test.describe('Create', () => {
        test('SCEN-CRUD-001: Create scenario with name', async ({ page, createProject }) => {
            const projectId = await createProject(uniqueId('ScenProject'));
            const scenarioName = uniqueId('Scenario');

            await page.goto(`/projects/${projectId}`);

            // Click "New Scenario" button
            await page.getByRole('link', { name: /new scenario/i }).click();

            await expect(page).toHaveURL(`/projects/${projectId}/scenarios/new`);

            // Fill in name
            await page.getByLabel(/scenario name/i).fill(scenarioName);
            await page.getByRole('button', { name: /create/i }).click();

            // Should redirect to scenario view page
            await expect(page).toHaveURL(/\/projects\/\d+\/scenarios\/\d+$/);

            // Should show scenario name
            await expect(page.getByText(scenarioName)).toBeVisible();
        });

        test('SCEN-CRUD-002: Create scenario with description', async ({ page, createProject }) => {
            const projectId = await createProject(uniqueId('ScenProject'));
            const scenarioName = uniqueId('Scenario');
            const description = 'Test scenario description';

            await page.goto(`/projects/${projectId}/scenarios/new`);

            await page.getByLabel(/scenario name/i).fill(scenarioName);
            await page.getByLabel(/description/i).fill(description);
            await page.getByRole('button', { name: /create/i }).click();

            await expect(page).toHaveURL(/\/scenarios\/\d+$/);
        });
    });

    test.describe('Read', () => {
        test('SCEN-CRUD-003: View scenario details', async ({ page, createProject, createScenario }) => {
            const projectId = await createProject(uniqueId('ScenProject'));
            const scenarioName = uniqueId('ViewScenario');
            const scenarioId = await createScenario(projectId, scenarioName);

            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}`);

            // Should show scenario name
            await expect(page.getByText(scenarioName)).toBeVisible();

            // Should show empty state message
            await expect(page.getByText(/no connections/i)).toBeVisible();
        });

        test('Scenario appears in project list', async ({ page, createProject, createScenario }) => {
            const projectId = await createProject(uniqueId('ScenProject'));
            const scenarioName = uniqueId('ListScenario');
            await createScenario(projectId, scenarioName);

            await page.goto(`/projects/${projectId}`);

            // Should see scenario in the list
            await expect(page.getByText(scenarioName)).toBeVisible();
        });
    });

    test.describe('Update', () => {
        test('SCEN-CRUD-004: Edit scenario name inline', async ({ page, createProject, createScenario }) => {
            const projectId = await createProject(uniqueId('ScenProject'));
            const originalName = uniqueId('OriginalScen');
            const scenarioId = await createScenario(projectId, originalName);

            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            // Find the editable title and click to edit
            const titleElement = page.getByText(originalName);
            await titleElement.click();

            // Should show an input field
            const input = page.getByRole('textbox').first();
            await input.clear();
            const newName = uniqueId('UpdatedScen');
            await input.fill(newName);

            // Press Enter to save or blur
            await input.press('Enter');

            // Name should be updated
            await expect(page.getByText(newName)).toBeVisible();
        });
    });

    test.describe('Delete', () => {
        test('Delete scenario from edit page', async ({ page, createProject, createScenario }) => {
            const projectId = await createProject(uniqueId('ScenProject'));
            const scenarioName = uniqueId('DeleteScen');
            const scenarioId = await createScenario(projectId, scenarioName);

            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            // Set up dialog handler
            page.on('dialog', dialog => dialog.accept());

            // Click delete button
            await page.getByRole('button', { name: /delete scenario/i }).click();

            // Should redirect to project view
            await expect(page).toHaveURL(`/projects/${projectId}`);

            // Scenario should not be in list
            await expect(page.getByText(scenarioName)).not.toBeVisible();
        });
    });
});
