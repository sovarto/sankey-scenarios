/**
 * Project Management - CRUD Tests
 *
 * Test IDs: PROJ-CRUD-001 through PROJ-CRUD-008
 */

import { test, expect, AUTH_STORAGE, uniqueId } from '../fixtures/test-fixtures';

test.describe('Project CRUD', () => {
    // Use authenticated member for all tests
    test.use({ storageState: AUTH_STORAGE.member });

    test.describe('Create', () => {
        test('PROJ-CRUD-001: Create project with name and description', async ({ page }) => {
            const projectName = uniqueId('Project');
            const description = 'Test project description';

            await page.goto('/projects/new');

            await page.getByLabel(/project name/i).fill(projectName);
            await page.getByLabel('Description').fill(description);
            await page.getByRole('button', { name: /create/i }).click();

            // Should redirect to project view
            await expect(page).toHaveURL(/\/projects\/\d+/);

            // Should show project name
            await expect(page.getByRole('heading', { name: projectName })).toBeVisible();

            // Should show description
            await expect(page.getByText(description)).toBeVisible();
        });

        test('PROJ-CRUD-002: Name is required', async ({ page }) => {
            await page.goto('/projects/new');

            // Try to submit without name
            await page.getByRole('button', { name: /create/i }).click();

            // Should show validation error or stay on page
            const nameInput = page.getByLabel(/project name/i);
            await expect(nameInput).toHaveAttribute('required', '');
        });

        test('Create project with only name (no description)', async ({ page }) => {
            const projectName = uniqueId('Project');

            await page.goto('/projects/new');
            await page.getByLabel(/project name/i).fill(projectName);
            await page.getByRole('button', { name: /create/i }).click();

            await expect(page).toHaveURL(/\/projects\/\d+/);
            await expect(page.getByRole('heading', { name: projectName })).toBeVisible();
        });
    });

    test.describe('Read', () => {
        test('PROJ-CRUD-003: View project details', async ({ page, createProject }) => {
            const projectName = uniqueId('ViewProject');
            const projectId = await createProject(projectName, 'Description for viewing');

            // Navigate away and back
            await page.goto('/projects');
            await page.goto(`/projects/${projectId}`);

            // Should show project details
            await expect(page.getByRole('heading', { name: projectName })).toBeVisible();

            // Should show sections for scenarios, groups, nodes
            await expect(page.getByRole('heading', { name: 'Scenarios', exact: true })).toBeVisible();
        });

        test('PROJ-LIST-001: View owned projects in list', async ({ page, createProject }) => {
            const projectName = uniqueId('ListProject');
            await createProject(projectName);

            await page.goto('/projects');

            // Should show in "My Projects" section
            await expect(page.getByText(projectName)).toBeVisible();
        });

        test('PROJ-LIST-003: Empty state when no projects', async ({ page }) => {
            // This test assumes a fresh user with no projects
            // May need adjustment based on test isolation strategy
            await page.goto('/projects');

            // If no projects exist, should show empty state
            // Note: This may need to be run in isolation
        });
    });

    test.describe('Update', () => {
        test('PROJ-CRUD-004: Edit project name', async ({ page, createProject }) => {
            const originalName = uniqueId('OriginalName');
            const newName = uniqueId('UpdatedName');
            const projectId = await createProject(originalName);

            await page.goto(`/projects/${projectId}/edit`);
            await page.getByLabel(/project name/i).fill(newName);
            await page.getByRole('button', { name: /save|update/i }).click();

            // Should redirect to project view with new name
            await expect(page).toHaveURL(`/projects/${projectId}`);
            await expect(page.getByRole('heading', { name: newName })).toBeVisible();
        });

        test('Edit project description', async ({ page, createProject }) => {
            const projectName = uniqueId('DescProject');
            const projectId = await createProject(projectName, 'Original description');

            await page.goto(`/projects/${projectId}/edit`);
            await page.getByLabel('Description').fill('Updated description');
            await page.getByRole('button', { name: /save|update/i }).click();

            await expect(page).toHaveURL(`/projects/${projectId}`);
            await expect(page.getByText('Updated description')).toBeVisible();
        });
    });

    test.describe('Delete', () => {
        test('PROJ-CRUD-005: Delete project', async ({ page, createProject }) => {
            const projectName = uniqueId('DeleteProject');
            const projectId = await createProject(projectName);

            await page.goto(`/projects/${projectId}/edit`);

            // Set up dialog handler before clicking delete (browser confirm)
            page.on('dialog', dialog => dialog.accept());

            // Click delete button
            await page.getByRole('button', { name: /delete project/i }).click();

            // Should redirect to projects list
            await expect(page).toHaveURL('/projects');

            // Project should no longer appear
            await expect(page.getByText(projectName)).not.toBeVisible();
        });
    });

    test.describe('Navigation', () => {
        test('Back to home from project list', async ({ page }) => {
            await page.goto('/projects');

            await page.getByRole('link', { name: /back|home/i }).click();

            await expect(page).toHaveURL('/');
        });

        test('New project button from list', async ({ page }) => {
            await page.goto('/projects');

            await page.getByRole('link', { name: /new project/i }).click();

            await expect(page).toHaveURL('/projects/new');
        });
    });
});
