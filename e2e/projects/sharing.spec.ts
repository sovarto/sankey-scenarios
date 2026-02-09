/**
 * Project Management - Sharing Tests
 *
 * Test IDs: PROJ-SHARE-001 through PROJ-SHARE-009
 */

import { test, expect, AUTH_STORAGE, TEST_USERS, uniqueId, BASE_URL } from '../fixtures/test-fixtures';

test.describe('Project Sharing', () => {
    test.describe('Share Modal', () => {
        test.use({ storageState: AUTH_STORAGE.admin });

        test('PROJ-SHARE-001: Share button visible for owner', async ({ page, createProject }) => {
            const projectId = await createProject(uniqueId('ShareProject'));

            await page.goto(`/projects/${projectId}`);

            // Share button should be visible for owner
            await expect(page.getByRole('button', { name: /share/i })).toBeVisible();
        });

        test('PROJ-SHARE-002: Open share modal', async ({ page, createProject }) => {
            const projectId = await createProject(uniqueId('ShareProject'));

            await page.goto(`/projects/${projectId}`);
            await page.getByRole('button', { name: /share/i }).click();

            // Modal should open
            await expect(page.getByRole('heading', { name: 'Share Project' })).toBeVisible();
            await expect(page.getByPlaceholder('Enter email address')).toBeVisible();
        });

        test('PROJ-SHARE-003: Add collaborator with readonly access', async ({ page, createProject }) => {
            const projectId = await createProject(uniqueId('ShareProject'));

            await page.goto(`/projects/${projectId}`);
            await page.getByRole('button', { name: /share/i }).click();

            // Add member as collaborator
            await page.getByPlaceholder('Enter email address').fill(TEST_USERS.member.email);
            await page.getByRole('combobox').selectOption('readonly');
            await page.getByRole('button', { name: 'Add' }).click();

            // Collaborator should appear in list
            await expect(page.getByText(TEST_USERS.member.name)).toBeVisible();
            await expect(page.getByText(TEST_USERS.member.email)).toBeVisible();
        });

        test('PROJ-SHARE-004: Add collaborator with readwrite access', async ({ page, createProject }) => {
            const projectId = await createProject(uniqueId('ShareProject'));

            await page.goto(`/projects/${projectId}`);
            await page.getByRole('button', { name: /share/i }).click();

            // Add member as collaborator with edit permissions
            await page.getByPlaceholder('Enter email address').fill(TEST_USERS.member.email);
            await page.getByRole('combobox').first().selectOption('readwrite');
            await page.getByRole('button', { name: 'Add' }).click();

            // Collaborator should appear with edit permissions
            await expect(page.getByText(TEST_USERS.member.name)).toBeVisible();
        });

        test('PROJ-SHARE-005: Cannot share with yourself', async ({ page, createProject }) => {
            const projectId = await createProject(uniqueId('ShareProject'));

            await page.goto(`/projects/${projectId}`);
            await page.getByRole('button', { name: /share/i }).click();

            // Try to share with self (admin)
            await page.getByPlaceholder('Enter email address').fill(TEST_USERS.admin.email);
            await page.getByRole('button', { name: 'Add' }).click();

            // Should show error
            await expect(page.getByText(/cannot share with yourself/i)).toBeVisible();
        });

        test('PROJ-SHARE-006: Cannot share with non-existent user', async ({ page, createProject }) => {
            const projectId = await createProject(uniqueId('ShareProject'));

            await page.goto(`/projects/${projectId}`);
            await page.getByRole('button', { name: /share/i }).click();

            // Try to share with non-existent email
            await page.getByPlaceholder('Enter email address').fill('nonexistent@example.com');
            await page.getByRole('button', { name: 'Add' }).click();

            // Should show error
            await expect(page.getByText(/user not found/i)).toBeVisible();
        });

        test('PROJ-SHARE-007: Update collaborator permission', async ({ page, createProject }) => {
            const projectId = await createProject(uniqueId('ShareProject'));

            await page.goto(`/projects/${projectId}`);
            await page.getByRole('button', { name: /share/i }).click();

            // First add collaborator as readonly
            await page.getByPlaceholder('Enter email address').fill(TEST_USERS.member.email);
            await page.getByRole('combobox').first().selectOption('readonly');
            await page.getByRole('button', { name: 'Add' }).click();

            await expect(page.getByText(TEST_USERS.member.name)).toBeVisible();

            // Find the permission dropdown for this user and change it
            const userRow = page.locator('div').filter({ hasText: TEST_USERS.member.email }).first();
            const permissionSelect = userRow.getByRole('combobox').last();

            // Change to readwrite
            await permissionSelect.selectOption('readwrite');

            // Verify change (the form auto-submits on change)
            await expect(permissionSelect).toHaveValue('readwrite');
        });

        test('PROJ-SHARE-008: Remove collaborator', async ({ page, createProject }) => {
            const projectId = await createProject(uniqueId('ShareProject'));

            await page.goto(`/projects/${projectId}`);
            await page.getByRole('button', { name: /share/i }).click();

            // First add collaborator
            await page.getByPlaceholder('Enter email address').fill(TEST_USERS.member.email);
            await page.getByRole('button', { name: 'Add' }).click();

            await expect(page.getByText(TEST_USERS.member.name)).toBeVisible();

            // Remove collaborator - click the trash icon button
            await page.getByRole('button', { name: /remove access/i }).click();

            // Collaborator should be removed
            await expect(page.getByText(TEST_USERS.member.name)).not.toBeVisible();
        });

        test('Close share modal', async ({ page, createProject }) => {
            const projectId = await createProject(uniqueId('ShareProject'));

            await page.goto(`/projects/${projectId}`);
            await page.getByRole('button', { name: /share/i }).click();

            // Modal should open
            await expect(page.getByRole('heading', { name: 'Share Project' })).toBeVisible();

            // Click Done button
            await page.getByRole('button', { name: 'Done' }).click();

            // Modal should close
            await expect(page.getByRole('heading', { name: 'Share Project' })).not.toBeVisible();
        });
    });

    test.describe('Shared Project Access', () => {
        test('PROJ-SHARE-009: Shared project appears in list', async ({ browser, createProject }) => {
            // Admin creates and shares a project
            const adminContext = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.admin
            });
            const adminPage = await adminContext.newPage();

            // Create project fixture helper needs page in context
            const projectName = uniqueId('SharedToMember');
            await adminPage.goto('/projects/new');
            await adminPage.getByLabel(/project name/i).fill(projectName);
            await adminPage.getByRole('button', { name: /create/i }).click();

            // Get project ID from URL
            await adminPage.waitForURL(/\/projects\/\d+/);
            const projectId = adminPage.url().split('/').pop();

            // Share with member
            await adminPage.getByRole('button', { name: /share/i }).click();
            await adminPage.getByPlaceholder('Enter email address').fill(TEST_USERS.member.email);
            await adminPage.getByRole('button', { name: 'Add' }).click();
            await expect(adminPage.getByText(TEST_USERS.member.name)).toBeVisible();
            await adminPage.getByRole('button', { name: 'Done' }).click();

            await adminContext.close();

            // Member should see the shared project
            const memberContext = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.member
            });
            const memberPage = await memberContext.newPage();

            await memberPage.goto('/projects');

            // Should see the shared project
            await expect(memberPage.getByText(projectName)).toBeVisible();

            await memberContext.close();
        });

        test('PROJ-LIST-002: View shared projects (readonly)', async ({ browser }) => {
            // Admin creates and shares a project with readonly
            const adminContext = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.admin
            });
            const adminPage = await adminContext.newPage();

            const projectName = uniqueId('ReadonlyShare');
            await adminPage.goto('/projects/new');
            await adminPage.getByLabel(/project name/i).fill(projectName);
            await adminPage.getByRole('button', { name: /create/i }).click();
            await adminPage.waitForURL(/\/projects\/\d+/);

            const projectId = adminPage.url().split('/').pop();

            // Share with readonly
            await adminPage.getByRole('button', { name: /share/i }).click();
            await adminPage.getByPlaceholder('Enter email address').fill(TEST_USERS.member.email);
            await adminPage.getByRole('combobox').first().selectOption('readonly');
            await adminPage.getByRole('button', { name: 'Add' }).click();
            await expect(adminPage.getByText(TEST_USERS.member.name)).toBeVisible();

            await adminContext.close();

            // Member opens the shared project
            const memberContext = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.member
            });
            const memberPage = await memberContext.newPage();

            await memberPage.goto(`/projects/${projectId}`);

            // Should see "View Only" badge
            await expect(memberPage.getByText(/view only/i)).toBeVisible();

            // Should NOT see Edit button
            await expect(memberPage.getByRole('link', { name: /edit project/i })).not.toBeVisible();

            await memberContext.close();
        });

        test('Shared project with edit permission shows edit button', async ({ browser }) => {
            // Admin creates and shares with readwrite
            const adminContext = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.admin
            });
            const adminPage = await adminContext.newPage();

            const projectName = uniqueId('EditShare');
            await adminPage.goto('/projects/new');
            await adminPage.getByLabel(/project name/i).fill(projectName);
            await adminPage.getByRole('button', { name: /create/i }).click();
            await adminPage.waitForURL(/\/projects\/\d+/);

            const projectId = adminPage.url().split('/').pop();

            // Share with readwrite
            await adminPage.getByRole('button', { name: /share/i }).click();
            await adminPage.getByPlaceholder('Enter email address').fill(TEST_USERS.member.email);
            await adminPage.getByRole('combobox').first().selectOption('readwrite');
            await adminPage.getByRole('button', { name: 'Add' }).click();
            await expect(adminPage.getByText(TEST_USERS.member.name)).toBeVisible();

            await adminContext.close();

            // Member opens the shared project
            const memberContext = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.member
            });
            const memberPage = await memberContext.newPage();

            await memberPage.goto(`/projects/${projectId}`);

            // Should see "Can Edit" badge
            await expect(memberPage.getByText(/can edit/i)).toBeVisible();

            // Should see Edit button
            await expect(memberPage.getByRole('link', { name: /edit project/i })).toBeVisible();

            await memberContext.close();
        });

        test('Share button not visible for non-owner', async ({ browser }) => {
            // Admin creates and shares with member
            const adminContext = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.admin
            });
            const adminPage = await adminContext.newPage();

            const projectName = uniqueId('NoShareButton');
            await adminPage.goto('/projects/new');
            await adminPage.getByLabel(/project name/i).fill(projectName);
            await adminPage.getByRole('button', { name: /create/i }).click();
            await adminPage.waitForURL(/\/projects\/\d+/);

            const projectId = adminPage.url().split('/').pop();

            // Share with member
            await adminPage.getByRole('button', { name: /share/i }).click();
            await adminPage.getByPlaceholder('Enter email address').fill(TEST_USERS.member.email);
            await adminPage.getByRole('button', { name: 'Add' }).click();

            await adminContext.close();

            // Member opens the shared project
            const memberContext = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.member
            });
            const memberPage = await memberContext.newPage();

            await memberPage.goto(`/projects/${projectId}`);

            // Share button should NOT be visible
            await expect(memberPage.getByRole('button', { name: /share/i })).not.toBeVisible();

            await memberContext.close();
        });
    });
});
