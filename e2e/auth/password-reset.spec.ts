/**
 * Authentication - Password Reset Tests
 *
 * Test IDs: AUTH-RESET-001 through AUTH-RESET-005
 */

import { test, expect, TEST_USERS, AUTH_STORAGE, BASE_URL, uniqueId } from '../fixtures/test-fixtures';

test.describe('Password Reset', () => {
    test.describe('Request Password Reset', () => {
        test('AUTH-RESET-001: Request password reset for valid email', async ({ page }) => {
            await page.goto('/forgot-password');

            await page.getByLabel('Email address').fill(TEST_USERS.member.email);
            await page.getByRole('button', { name: /send reset|reset password|submit/i }).click();

            // Should show success message (always, to prevent email enumeration)
            await expect(page.getByText(/if an account exists/i)).toBeVisible();
        });

        test('AUTH-RESET-002: Request shows same message for non-existent email', async ({ page }) => {
            await page.goto('/forgot-password');

            await page.getByLabel('Email address').fill('nonexistent@example.com');
            await page.getByRole('button', { name: /send reset|reset password|submit/i }).click();

            // Should show same success message (no email enumeration)
            await expect(page.getByText(/if an account exists/i)).toBeVisible();
        });

        test('Email field is required', async ({ page }) => {
            await page.goto('/forgot-password');

            const emailInput = page.getByLabel('Email address');
            await expect(emailInput).toHaveAttribute('required', '');
        });

        test('Development mode shows reset link', async ({ page }) => {
            await page.goto('/forgot-password');

            await page.getByLabel('Email address').fill(TEST_USERS.member.email);
            await page.getByRole('button', { name: /send reset|reset password|submit/i }).click();

            // In dev mode, the reset link should be shown
            await expect(page.getByText(/development mode|reset link/i)).toBeVisible();
            await expect(page.getByRole('link', { name: /reset-password\?token/i })).toBeVisible();
        });
    });

    test.describe('Reset Password', () => {
        test('AUTH-RESET-003: Reset password with valid token', async ({ page }) => {
            // Create a dedicated user so we don't destroy the member's session/password
            const resetEmail = `${uniqueId('reset')}@test.com`;
            const signupCtx = await page.context().browser()!.newContext({ baseURL: BASE_URL });
            const resp = await signupCtx.request.post('/signup', {
                form: {
                    name: 'Reset User',
                    email: resetEmail,
                    password: 'TestPassword123!',
                    confirmPassword: 'TestPassword123!',
                    displayLocale: 'en',
                    regionalLocale: 'en'
                }
            });
            expect(resp.ok()).toBeTruthy();
            await signupCtx.close();

            // Approve the user via admin context
            const adminCtx = await page.context().browser()!.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.admin
            });
            const adminPage = await adminCtx.newPage();
            await adminPage.goto('/admin/users');
            const pendingRow = adminPage.locator('tr').filter({ hasText: resetEmail });
            await pendingRow.getByRole('link', { name: /manage/i }).click();
            await adminPage.getByRole('button', { name: /approve/i }).click();
            await expect(adminPage.getByRole('main').getByText(/active/i)).toBeVisible();
            await adminCtx.close();

            // Now request password reset for the dedicated user
            await page.goto('/forgot-password');
            await page.getByLabel('Email address').fill(resetEmail);
            await page.getByRole('button', { name: /send reset|reset password|submit/i }).click();

            // Get the reset link from development mode display
            const resetLink = page.getByRole('link', { name: /reset-password\?token/i });
            await expect(resetLink).toBeVisible();

            // Click the reset link
            await resetLink.click();

            // Should be on reset password page
            await expect(page).toHaveURL(/\/reset-password\?token=/);

            // Fill in new password
            const newPassword = 'NewSecurePassword123!';
            await page.getByLabel('New Password', { exact: true }).fill(newPassword);
            await page.getByLabel('Confirm New Password').fill(newPassword);
            await page.getByRole('button', { name: /reset password|submit/i }).click();

            // Should show success message
            await expect(page.getByText(/password.*reset|success/i)).toBeVisible();

            // Should have link to login
            await expect(page.getByRole('link', { name: /go to login/i })).toBeVisible();
        });

        test('AUTH-RESET-004: Expired/invalid token shows error', async ({ page }) => {
            await page.goto('/reset-password?token=invalid-token-12345');

            // Fill in password form
            await page.getByLabel('New Password', { exact: true }).fill('NewPassword123!');
            await page.getByLabel('Confirm New Password').fill('NewPassword123!');
            await page.getByRole('button', { name: /reset password|submit/i }).click();

            // Should show error
            await expect(page.getByText(/invalid|expired/i)).toBeVisible();
        });

        test('AUTH-RESET-005: Missing token shows error page', async ({ page }) => {
            await page.goto('/reset-password');

            // Should show invalid/missing token message
            await expect(page.getByText(/invalid reset link/i)).toBeVisible();
        });

        test('Password mismatch on reset is rejected', async ({ page }) => {
            // First request a reset token
            await page.goto('/forgot-password');
            await page.getByLabel('Email address').fill(TEST_USERS.member.email);
            await page.getByRole('button', { name: /send reset|reset password|submit/i }).click();

            // Get and click the reset link
            const resetLink = page.getByRole('link', { name: /reset-password\?token/i });
            await expect(resetLink).toBeVisible();
            await resetLink.click();

            // Fill mismatched passwords
            await page.getByLabel('New Password', { exact: true }).fill('NewPassword123!');
            await page.getByLabel('Confirm New Password').fill('DifferentPassword456!');
            await page.getByRole('button', { name: /reset password|submit/i }).click();

            // Should show mismatch error
            await expect(page.getByText(/do not match|passwords must match/i)).toBeVisible();
        });

        test('Weak password on reset is rejected', async ({ page }) => {
            // First request a reset token
            await page.goto('/forgot-password');
            await page.getByLabel('Email address').fill(TEST_USERS.member.email);
            await page.getByRole('button', { name: /send reset|reset password|submit/i }).click();

            // Get and click the reset link
            const resetLink = page.getByRole('link', { name: /reset-password\?token/i });
            await expect(resetLink).toBeVisible();
            await resetLink.click();

            // Fill weak password
            await page.getByLabel('New Password', { exact: true }).fill('short');
            await page.getByLabel('Confirm New Password').fill('short');
            await page.getByRole('button', { name: /reset password|submit/i }).click();

            // Should show password requirements error
            await expect(page.getByText(/at least 8 characters|too short/i)).toBeVisible();
        });
    });

    test.describe('Navigation', () => {
        test('Back to login link from forgot password', async ({ page }) => {
            await page.goto('/forgot-password');

            await page.getByRole('link', { name: /back to login|sign in/i }).click();

            await expect(page).toHaveURL('/login');
        });
    });
});
