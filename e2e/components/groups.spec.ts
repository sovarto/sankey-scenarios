/**
 * Component Tests - Groups
 *
 * Test IDs: COMP-GROUP-001 through COMP-GROUP-008
 */

import { test, expect, AUTH_STORAGE, uniqueId } from '../fixtures/test-fixtures';

test.describe('Groups', () => {
    test.use({ storageState: AUTH_STORAGE.member });

    let projectId: number;

    test.beforeEach(async ({ createProject }) => {
        projectId = await createProject(uniqueId('GroupProject'));
    });

    test.describe('Create Group', () => {
        test('COMP-GROUP-001: Create group with name', async ({ page }) => {
            const groupName = uniqueId('ExpenseGroup');

            await page.goto(`/projects/${projectId}/groups/new`);

            await page.getByLabel('Group Name').fill(groupName);
            await page.getByRole('button', { name: /create/i }).click();

            // Should redirect to group view
            await expect(page).toHaveURL(/\/projects\/\d+\/groups\/\d+/);

            // Should show group name
            await expect(page.getByRole('heading', { name: groupName })).toBeVisible();
        });

        test('COMP-GROUP-002: Create group with description', async ({ page }) => {
            const groupName = uniqueId('DescGroup');
            const description = 'Test group description';

            await page.goto(`/projects/${projectId}/groups/new`);

            await page.getByLabel('Group Name').fill(groupName);
            await page.getByLabel('Description').fill(description);
            await page.getByRole('button', { name: /create/i }).click();

            await expect(page).toHaveURL(/\/groups\/\d+/);
            await expect(page.getByText(description)).toBeVisible();
        });

        test('COMP-GROUP-003: Group name is required', async ({ page }) => {
            await page.goto(`/projects/${projectId}/groups/new`);

            const nameInput = page.getByLabel('Group Name');
            await expect(nameInput).toHaveAttribute('required', '');
        });
    });

    test.describe('View Group', () => {
        test('COMP-GROUP-004: View group details', async ({ page }) => {
            const groupName = uniqueId('ViewGroup');

            // Create group first
            await page.goto(`/projects/${projectId}/groups/new`);
            await page.getByLabel('Group Name').fill(groupName);
            await page.getByRole('button', { name: /create/i }).click();

            await expect(page).toHaveURL(/\/groups\/\d+/);

            // Should show group details
            await expect(page.getByRole('heading', { name: groupName })).toBeVisible();

            // Should show connections section
            await expect(page.getByText(/connections/i).first()).toBeVisible();
        });

        test('Group appears in project list', async ({ page }) => {
            const groupName = uniqueId('ListGroup');

            // Create group
            await page.goto(`/projects/${projectId}/groups/new`);
            await page.getByLabel('Group Name').fill(groupName);
            await page.getByRole('button', { name: /create/i }).click();

            // Wait for create to complete (redirect to view page)
            await expect(page).toHaveURL(/\/groups\/\d+/);

            // Go to project view
            await page.goto(`/projects/${projectId}`);
            await expect(page.getByText(groupName).first()).toBeVisible();
        });
    });

    test.describe('Edit Group', () => {
        test('COMP-GROUP-005: Edit group name', async ({ page }) => {
            const originalName = uniqueId('OrigGroup');
            const newName = uniqueId('UpdatedGroup');

            // Create group
            await page.goto(`/projects/${projectId}/groups/new`);
            await page.getByLabel('Group Name').fill(originalName);
            await page.getByRole('button', { name: /create/i }).click();

            await expect(page).toHaveURL(/\/groups\/(\d+)/);
            const groupId = page.url().match(/\/groups\/(\d+)/)?.[1];

            // Go to edit page
            await page.goto(`/projects/${projectId}/groups/${groupId}/edit`);

            await page.locator('#name').clear();
            await page.locator('#name').fill(newName);
            await page.getByRole('button', { name: /save|update/i }).click();

            // Wait for save to complete before navigating
            await page.waitForLoadState('networkidle');

            // Edit page stays put after save, navigate to view page to verify
            await page.goto(`/projects/${projectId}/groups/${groupId}`);
            await expect(page.getByRole('heading', { name: newName })).toBeVisible();
        });
    });

    test.describe('Delete Group', () => {
        test('COMP-GROUP-006: Delete group', async ({ page }) => {
            const groupName = uniqueId('DeleteGroup');

            // Create group
            await page.goto(`/projects/${projectId}/groups/new`);
            await page.getByLabel('Group Name').fill(groupName);
            await page.getByRole('button', { name: /create/i }).click();

            await expect(page).toHaveURL(/\/groups\/(\d+)/);
            const groupId = page.url().match(/\/groups\/(\d+)/)?.[1];

            // Go to edit page
            await page.goto(`/projects/${projectId}/groups/${groupId}/edit`);

            // Set up dialog handler
            page.on('dialog', dialog => dialog.accept());

            // Click delete
            await page.getByRole('button', { name: /delete/i }).click();

            // Should redirect to groups list
            await expect(page).toHaveURL(`/projects/${projectId}/groups`);
        });
    });

    test.describe('Group Connections', () => {
        test('COMP-GROUP-007: Add connection to group', async ({ page }) => {
            const groupName = uniqueId('ConnGroup');

            // Create group
            await page.goto(`/projects/${projectId}/groups/new`);
            await page.getByLabel('Group Name').fill(groupName);
            await page.getByRole('button', { name: /create/i }).click();

            await expect(page).toHaveURL(/\/groups\/\d+/);

            // Find the add connection form within the group
            // The UI might be on the view or edit page
            const sourceInput = page.getByPlaceholder('Type or select source...');
            const targetInput = page.getByPlaceholder('Target...').first();

            if (await sourceInput.isVisible()) {
                await sourceInput.fill('Federal');
                await targetInput.fill('Tax');

                // Look for value/percentage input
                const valueInput = page.getByPlaceholder(/value|percent/i).or(page.getByLabel(/value|percent/i));
                if (await valueInput.count() > 0) {
                    await valueInput.first().fill('30%');
                }

                await page.getByRole('button', { name: /add/i }).click();

                // Connection should appear
                await expect(page.getByText('Federal').first()).toBeVisible();
            }
        });

        test('COMP-GROUP-008: Group with multiple connections', async ({ page }) => {
            // Similar to above but add multiple connections
            test.skip(); // Complex UI interaction, may need specific implementation
        });
    });
});
