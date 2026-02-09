/**
 * Authentication - Login Tests
 *
 * Test IDs: AUTH-LOGIN-001 through AUTH-LOGIN-007
 */

import { test, expect, TEST_USERS, AUTH_STORAGE, BASE_URL } from '../fixtures/test-fixtures';

test.describe('Login', () => {
    test.describe('Successful login', () => {
        test('AUTH-LOGIN-001: Login with valid credentials', async ({ page }) => {
            await page.goto('/login');

            await page.getByLabel('Email address').fill(TEST_USERS.member.email);
            await page.getByLabel('Password').fill(TEST_USERS.member.password);
            await page.getByRole('button', { name: 'Sign in' }).click();

            // Should redirect to home
            await expect(page).toHaveURL('/');

            // Should show user name
            await expect(page.getByText(TEST_USERS.member.name)).toBeVisible();
        });

        test('AUTH-LOGIN-006: Redirect if already logged in', async ({ browser }) => {
            // Use saved auth state
            const context = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.member
            });
            const page = await context.newPage();

            await page.goto('/login');

            // Should be redirected to home
            await expect(page).toHaveURL('/');

            await context.close();
        });

        test('AUTH-LOGIN-007: Email is case-insensitive', async ({ page }) => {
            await page.goto('/login');

            // Use uppercase email
            await page.getByLabel('Email address').fill(TEST_USERS.member.email.toUpperCase());
            await page.getByLabel('Password').fill(TEST_USERS.member.password);
            await page.getByRole('button', { name: 'Sign in' }).click();

            // Should still succeed
            await expect(page).toHaveURL('/');
        });
    });

    test.describe('Failed login', () => {
        test('AUTH-LOGIN-002: Invalid password shows error', async ({ page }) => {
            await page.goto('/login');

            await page.getByLabel('Email address').fill(TEST_USERS.member.email);
            await page.getByLabel('Password').fill('WrongPassword123!');
            await page.getByRole('button', { name: 'Sign in' }).click();

            // Should show error message
            await expect(page.getByText('Invalid email or password')).toBeVisible();

            // Should stay on login page
            await expect(page).toHaveURL('/login');
        });

        test('AUTH-LOGIN-003: Non-existent user shows error', async ({ page }) => {
            await page.goto('/login');

            await page.getByLabel('Email address').fill('nonexistent@test.com');
            await page.getByLabel('Password').fill('SomePassword123!');
            await page.getByRole('button', { name: 'Sign in' }).click();

            // Should show same error (no email enumeration)
            await expect(page.getByText('Invalid email or password')).toBeVisible();
        });
    });

    test.describe('Account status checks', () => {
        // Note: These tests require pending/blocked users to exist
        // They may need to be created in setup or skipped if not applicable

        test.skip('AUTH-LOGIN-004: Pending user cannot login', async ({ page }) => {
            await page.goto('/login');

            await page.getByLabel('Email address').fill(TEST_USERS.pending.email);
            await page.getByLabel('Password').fill(TEST_USERS.pending.password);
            await page.getByRole('button', { name: 'Sign in' }).click();

            await expect(page.getByText(/pending approval/i)).toBeVisible();
        });

        test.skip('AUTH-LOGIN-005: Blocked user cannot login', async ({ page }) => {
            await page.goto('/login');

            await page.getByLabel('Email address').fill(TEST_USERS.blocked.email);
            await page.getByLabel('Password').fill(TEST_USERS.blocked.password);
            await page.getByRole('button', { name: 'Sign in' }).click();

            await expect(page.getByText(/blocked/i)).toBeVisible();
        });
    });

    test.describe('Form validation', () => {
        test('Email field is required', async ({ page }) => {
            await page.goto('/login');

            await page.getByLabel('Password').fill('SomePassword');
            await page.getByRole('button', { name: 'Sign in' }).click();

            // Check for HTML5 validation or custom error
            const emailInput = page.getByLabel('Email address');
            await expect(emailInput).toHaveAttribute('required', '');
        });

        test('Password field is required', async ({ page }) => {
            await page.goto('/login');

            await page.getByLabel('Email address').fill('test@test.com');
            await page.getByRole('button', { name: 'Sign in' }).click();

            // Check for HTML5 validation or custom error
            const passwordInput = page.getByLabel('Password');
            await expect(passwordInput).toHaveAttribute('required', '');
        });
    });

    test.describe('Navigation', () => {
        test('Forgot password link works', async ({ page }) => {
            await page.goto('/login');

            await page.getByRole('link', { name: /forgot/i }).click();

            await expect(page).toHaveURL('/forgot-password');
        });

        test('Sign up link works', async ({ page }) => {
            await page.goto('/login');

            await page.getByRole('link', { name: /create an account/i }).click();

            await expect(page).toHaveURL('/signup');
        });
    });
});
