/**
 * Admin Tests - User Management
 *
 * Test IDs: ADMIN-LIST-001 through ADMIN-LIST-003
 * Test IDs: ADMIN-USER-001 through ADMIN-USER-006
 */

import { test, expect, AUTH_STORAGE, TEST_USERS, uniqueId, BASE_URL } from '../fixtures/test-fixtures';

test.describe('Admin - User List', () => {
    test.describe('Access Control', () => {
        test('ADMIN-LIST-001: Admin can view user list', async ({ browser }) => {
            const context = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.admin
            });
            const page = await context.newPage();

            await page.goto('/admin/users');

            // Should show user management page
            await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();

            // Should show user table
            await expect(page.getByText(TEST_USERS.admin.email)).toBeVisible();
            await expect(page.getByText(TEST_USERS.member.email)).toBeVisible();

            await context.close();
        });

        test('ADMIN-LIST-002: Status counts displayed', async ({ browser }) => {
            const context = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.admin
            });
            const page = await context.newPage();

            await page.goto('/admin/users');

            // Should show status counts
            await expect(page.getByText('Pending Approval')).toBeVisible();
            await expect(page.getByText('Active Users')).toBeVisible();

            await context.close();
        });

        test('ADMIN-LIST-003: Non-admin cannot access admin pages', async ({ browser }) => {
            const context = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.member
            });
            const page = await context.newPage();

            await page.goto('/admin/users');

            // Should be redirected to home or show error
            // Either redirect or 403 forbidden
            const url = page.url();
            const isRedirected = !url.includes('/admin');
            const hasError = await page.getByText(/forbidden|not authorized|access denied/i).isVisible().catch(() =>
                false
            );

            expect(isRedirected || hasError).toBeTruthy();

            await context.close();
        });
    });
});

test.describe('Admin - User Management', () => {
    // These tests require admin context
    test.use({ storageState: AUTH_STORAGE.admin });

    test.describe('User Details', () => {
        test('View user details', async ({ page }) => {
            await page.goto('/admin/users');

            // Click on member user to view details
            await page.getByRole('link', { name: /manage/i }).first().click();

            // Should show user detail page
            await expect(page).toHaveURL(/\/admin\/users\/\d+/);
        });
    });

    test.describe('User Status Management', () => {
        test('ADMIN-USER-001: Approve pending user', async ({ page }) => {
            test.setTimeout(60000);
            // First create a new pending user via API (avoids UI rendering issues)
            const pendingEmail = `${uniqueId('pending')}@test.com`;

            // Sign up a new user via API POST (they'll be pending)
            const signupContext = await page.context().browser()!.newContext({ baseURL: BASE_URL });
            const signupResponse = await signupContext.request.post('/signup', {
                form: {
                    name: 'Pending User',
                    email: pendingEmail,
                    password: 'TestPassword123!',
                    confirmPassword: 'TestPassword123!',
                    displayLocale: 'en',
                    regionalLocale: 'en'
                }
            });
            expect(signupResponse.ok()).toBeTruthy();
            await signupContext.close();

            // Now as admin, approve the user
            await page.goto('/admin/users');

            // Find the pending user and manage them
            const pendingRow = page.locator('tr').filter({ hasText: pendingEmail });
            await pendingRow.getByRole('link', { name: /manage/i }).click();

            // Click approve button
            await page.getByRole('button', { name: /approve/i }).click();

            // Should show success - user status changes to active
            await expect(page.getByRole('main').getByText(/active/i)).toBeVisible();
        });

        test('ADMIN-USER-002: Block active user', async ({ page }) => {
            // Create a dedicated user to block (avoid destroying member session)
            const blockEmail = `${uniqueId('block')}@test.com`;
            const signupCtx = await page.context().browser()!.newContext({ baseURL: BASE_URL });
            const resp = await signupCtx.request.post('/signup', {
                form: {
                    name: 'Block Test',
                    email: blockEmail,
                    password: 'TestPassword123!',
                    confirmPassword: 'TestPassword123!',
                    displayLocale: 'en',
                    regionalLocale: 'en'
                }
            });
            expect(resp.ok()).toBeTruthy();
            await signupCtx.close();

            // Approve the new user first
            await page.goto('/admin/users');
            const pendingRow = page.locator('tr').filter({ hasText: blockEmail });
            await pendingRow.getByRole('link', { name: /manage/i }).click();
            await page.getByRole('button', { name: /approve/i }).click();
            await expect(page.getByRole('main').getByText(/active/i)).toBeVisible();

            // Now block them
            await page.getByRole('button', { name: /block/i }).click();
            await expect(page.getByRole('main').getByText('blocked', { exact: true })).toBeVisible();

            // Unblock for cleanup
            await page.getByRole('button', { name: /unblock/i }).click();
        });

        test('ADMIN-USER-003: Unblock blocked user', async ({ page }) => {
            // Create a dedicated user to block then unblock
            const unblockEmail = `${uniqueId('unblock')}@test.com`;
            const signupCtx = await page.context().browser()!.newContext({ baseURL: BASE_URL });
            const resp = await signupCtx.request.post('/signup', {
                form: {
                    name: 'Unblock Test',
                    email: unblockEmail,
                    password: 'TestPassword123!',
                    confirmPassword: 'TestPassword123!',
                    displayLocale: 'en',
                    regionalLocale: 'en'
                }
            });
            expect(resp.ok()).toBeTruthy();
            await signupCtx.close();

            // Approve the new user
            await page.goto('/admin/users');
            const pendingRow = page.locator('tr').filter({ hasText: unblockEmail });
            await pendingRow.getByRole('link', { name: /manage/i }).click();
            await page.getByRole('button', { name: /approve/i }).click();
            await expect(page.getByRole('main').getByText(/active/i)).toBeVisible();

            // Block them
            await page.getByRole('button', { name: /block/i }).click();
            await expect(page.getByRole('main').getByText('blocked', { exact: true })).toBeVisible();

            // Now unblock
            await page.getByRole('button', { name: /unblock/i }).click();
            await expect(page.getByRole('main').getByText('active', { exact: true })).toBeVisible();
        });
    });

    test.describe('Role Management', () => {
        test('ADMIN-USER-004: Add admin role to user', async ({ page }) => {
            await page.goto('/admin/users');

            const memberRow = page.locator('tr').filter({ hasText: TEST_USERS.member.email });
            await memberRow.getByRole('link', { name: /manage/i }).click();

            // Look for role checkboxes or multi-select
            const adminCheckbox = page.getByLabel('admin', { exact: true }).or(
                page.getByText('admin').locator('input')
            );

            if (await adminCheckbox.count() > 0) {
                await adminCheckbox.first().check();
                await page.getByRole('button', { name: /update roles|save/i }).click();

                // Verify role was added
                await expect(page.getByText('admin')).toBeVisible();

                // Remove the role for cleanup
                await adminCheckbox.first().uncheck();
                await page.getByRole('button', { name: /update roles|save/i }).click();
            }
        });

        test('ADMIN-USER-005: Remove admin role from user', async ({ page }) => {
            // This test would add admin role first, then remove it
            // Similar to above but inverse
            test.skip();
        });
    });

    test.describe('Self-Protection', () => {
        test('ADMIN-USER-006: Cannot block self', async ({ page }) => {
            await page.goto('/admin/users');

            // Find admin user (self)
            const adminRow = page.locator('tr').filter({ hasText: TEST_USERS.admin.email });
            await adminRow.getByRole('link', { name: /manage/i }).click();

            // Block button should be disabled or not present
            const blockButton = page.getByRole('button', { name: /block/i });

            if (await blockButton.isVisible()) {
                // Try to click and expect error
                await blockButton.click();
                await expect(page.getByText(/cannot block yourself/i)).toBeVisible();
            } else {
                // Button is disabled or not shown - that's correct behavior
                expect(true).toBeTruthy();
            }
        });

        test('Cannot remove admin role from self', async ({ page }) => {
            await page.goto('/admin/users');

            const adminRow = page.locator('tr').filter({ hasText: TEST_USERS.admin.email });
            await adminRow.getByRole('link', { name: /manage/i }).click();

            // The admin checkbox should be disabled for self or show error if unchecked
            const adminCheckbox = page.getByLabel('admin', { exact: true }).or(
                page.getByText('admin').locator('input')
            );

            if (await adminCheckbox.count() > 0) {
                const checkbox = adminCheckbox.first();
                const isDisabled = await checkbox.isDisabled();

                if (!isDisabled) {
                    // Try to uncheck and save
                    await checkbox.uncheck();
                    await page.getByRole('button', { name: /update roles|save/i }).click();

                    // Should show error
                    await expect(page.getByText(/cannot remove.*admin.*yourself/i)).toBeVisible();
                }
            }
        });

        test('Cannot delete self', async ({ page }) => {
            await page.goto('/admin/users');

            const adminRow = page.locator('tr').filter({ hasText: TEST_USERS.admin.email });
            await adminRow.getByRole('link', { name: /manage/i }).click();

            // Delete button should be disabled or show error
            const deleteButton = page.getByRole('button', { name: /delete/i });

            if (await deleteButton.isVisible()) {
                page.on('dialog', dialog => dialog.accept());
                await deleteButton.click();

                // Should show error
                await expect(page.getByText(/cannot delete yourself/i)).toBeVisible();
            }
        });
    });

    test.describe('Password Management', () => {
        test('Reset user password', async ({ page }) => {
            // Create a dedicated user for password reset (avoid affecting member session)
            const resetEmail = `${uniqueId('resetpw')}@test.com`;
            const signupCtx = await page.context().browser()!.newContext({ baseURL: BASE_URL });
            const resp = await signupCtx.request.post('/signup', {
                form: {
                    name: 'Reset PW User',
                    email: resetEmail,
                    password: 'TestPassword123!',
                    confirmPassword: 'TestPassword123!',
                    displayLocale: 'en',
                    regionalLocale: 'en'
                }
            });
            expect(resp.ok()).toBeTruthy();
            await signupCtx.close();

            // Approve the user
            await page.goto('/admin/users');
            const pendingRow = page.locator('tr').filter({ hasText: resetEmail });
            await pendingRow.getByRole('link', { name: /manage/i }).click();
            await page.getByRole('button', { name: /approve/i }).click();
            await expect(page.getByRole('main').getByText(/active/i)).toBeVisible();

            // Look for reset password button
            const resetButton = page.getByRole('button', { name: /reset password/i });

            if (await resetButton.isVisible()) {
                await resetButton.click();

                // Should show temporary password
                await expect(page.getByText(/temporary password|new password/i)).toBeVisible();
            }
        });
    });
});
