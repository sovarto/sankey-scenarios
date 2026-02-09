/**
 * Authentication - Signup Tests
 *
 * Test IDs: AUTH-SIGNUP-001 through AUTH-SIGNUP-006
 */

import { test, expect, uniqueId, BASE_URL } from '../fixtures/test-fixtures';

test.describe('Signup', () => {
    test.describe('Successful Signup', () => {
        test('AUTH-SIGNUP-001: Complete signup with all fields', async ({ page }) => {
            const testEmail = `${uniqueId('user')}@test.com`;
            const testPassword = 'TestPassword123!';
            const testName = uniqueId('TestUser');

            await page.goto('/signup');

            await page.getByLabel('Full Name').fill(testName);
            await page.getByLabel('Email address').fill(testEmail);
            await page.getByLabel('Password', { exact: true }).fill(testPassword);
            await page.getByLabel('Confirm Password').fill(testPassword);
            await page.getByRole('button', { name: /create account/i }).click();

            // Should show success message
            await expect(page.getByRole('heading', { name: /account created/i })).toBeVisible();
            await expect(page.getByRole('link', { name: /go to login/i })).toBeVisible();
        });

        test('AUTH-SIGNUP-002: First user is auto-approved as admin', async ({ page, request }) => {
            // This test would require a fresh database
            // The auth.setup.ts already tests this implicitly
            // Skipping as it requires special setup
            test.skip();
        });

        test('AUTH-SIGNUP-003: Subsequent users are pending by default', async ({ page }) => {
            // Sign up a new user
            const testEmail = `${uniqueId('pending')}@test.com`;
            const testPassword = 'TestPassword123!';
            const testName = uniqueId('PendingUser');

            await page.goto('/signup');

            await page.getByLabel('Full Name').fill(testName);
            await page.getByLabel('Email address').fill(testEmail);
            await page.getByLabel('Password', { exact: true }).fill(testPassword);
            await page.getByLabel('Confirm Password').fill(testPassword);
            await page.getByRole('button', { name: /create account/i }).click();

            // Should show success message mentioning pending approval
            await expect(page.getByRole('heading', { name: /account created/i })).toBeVisible();
            await expect(page.getByText(/pending|approve|review/i)).toBeVisible();
        });
    });

    test.describe('Signup Validation', () => {
        test('AUTH-SIGNUP-004: Duplicate email shows error', async ({ page }) => {
            await page.goto('/signup');

            // Use member email that already exists from setup
            await page.getByLabel('Full Name').fill('Duplicate User');
            await page.getByLabel('Email address').fill('member@test.com');
            await page.getByLabel('Password', { exact: true }).fill('TestPassword123!');
            await page.getByLabel('Confirm Password').fill('TestPassword123!');
            await page.getByRole('button', { name: /create account/i }).click();

            // Should show error about existing email
            await expect(page.getByText(/already exists|already registered|already in use/i)).toBeVisible();
        });

        test('AUTH-SIGNUP-005: Weak password rejected', async ({ page }) => {
            await page.goto('/signup');

            await page.getByLabel('Full Name').fill('Weak Password User');
            await page.getByLabel('Email address').fill(`${uniqueId('weak')}@test.com`);
            await page.getByLabel('Password', { exact: true }).fill('short');
            await page.getByLabel('Confirm Password').fill('short');
            await page.getByRole('button', { name: /create account/i }).click();

            // Should show password requirements error
            await expect(page.getByText(/at least 8 characters|too short/i)).toBeVisible();
        });

        test('AUTH-SIGNUP-006: Password mismatch rejected', async ({ page }) => {
            await page.goto('/signup');

            await page.getByLabel('Full Name').fill('Mismatch User');
            await page.getByLabel('Email address').fill(`${uniqueId('mismatch')}@test.com`);
            await page.getByLabel('Password', { exact: true }).fill('TestPassword123!');
            await page.getByLabel('Confirm Password').fill('DifferentPassword456!');
            await page.getByRole('button', { name: /create account/i }).click();

            // Should show password mismatch error
            await expect(page.getByText(/do not match|passwords must match/i)).toBeVisible();
        });
    });

    test.describe('Form Validation', () => {
        test('Name field is required', async ({ page }) => {
            await page.goto('/signup');

            const nameInput = page.getByLabel('Full Name');
            await expect(nameInput).toHaveAttribute('required', '');
        });

        test('Email field is required', async ({ page }) => {
            await page.goto('/signup');

            const emailInput = page.getByLabel('Email address');
            await expect(emailInput).toHaveAttribute('required', '');
        });

        test('Password field is required', async ({ page }) => {
            await page.goto('/signup');

            const passwordInput = page.getByLabel('Password', { exact: true });
            await expect(passwordInput).toHaveAttribute('required', '');
        });

        test('Password minimum length enforced', async ({ page }) => {
            await page.goto('/signup');

            const passwordInput = page.getByLabel('Password', { exact: true });
            await expect(passwordInput).toHaveAttribute('minLength', '8');
        });
    });

    test.describe('Navigation', () => {
        test('Login link works', async ({ page }) => {
            await page.goto('/signup');

            await page.getByRole('link', { name: /sign in|log in/i }).click();

            await expect(page).toHaveURL('/login');
        });

        test('Redirects to home if already logged in', async ({ browser }) => {
            // Create context with auth
            const { AUTH_STORAGE } = await import('../fixtures/test-fixtures');
            const context = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.member
            });
            const page = await context.newPage();

            await page.goto('/signup');

            // Should redirect to home
            await expect(page).toHaveURL('/');

            await context.close();
        });
    });
});
