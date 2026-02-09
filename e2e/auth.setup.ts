/**
 * Authentication setup - runs before all tests
 *
 * Creates test users and saves authenticated sessions for reuse.
 */

import { test as setup, expect } from '@playwright/test';
import { TEST_USERS, AUTH_STORAGE, BASE_URL } from './fixtures/test-fixtures';

/**
 * Setup: Create admin user and save auth state
 *
 * Note: The first user registered becomes admin automatically.
 * This setup assumes a fresh test database.
 */
setup('authenticate as admin', async ({ page }) => {
    const { email, password, name } = TEST_USERS.admin;

    // Try to sign up first (in case this is a fresh database)
    await page.goto('/signup');

    // Check if we're on signup page (not redirected because already logged in)
    if (page.url().includes('/signup')) {
        await page.getByLabel('Full Name').fill(name);
        await page.getByLabel('Email address').fill(email);
        await page.getByLabel('Password', { exact: true }).fill(password);
        await page.getByLabel('Confirm Password').fill(password);
        await page.getByRole('button', { name: /sign up|create account/i }).click();

        // First user should be auto-approved as admin
        // Either redirected to home or shown success message
        await page.waitForURL('/', { timeout: 10000 }).catch(() => {
            // Might show success message instead of redirect
        });
    }

    // Now log in to get authenticated session
    await page.goto('/login');

    // If already logged in, will redirect to home
    if (page.url().includes('/login')) {
        await page.getByLabel('Email address').fill(email);
        await page.getByLabel('Password').fill(password);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page).toHaveURL('/');
    }

    // Save storage state
    await page.context().storageState({ path: AUTH_STORAGE.admin });
});

/**
 * Setup: Create member user and save auth state
 */
setup('authenticate as member', async ({ page }) => {
    const { email, password, name } = TEST_USERS.member;

    // First, login as admin to approve the member after creation
    await page.goto('/login');
    await page.getByLabel('Email address').fill(TEST_USERS.admin.email);
    await page.getByLabel('Password').fill(TEST_USERS.admin.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');

    // Sign up member user in a new context
    const memberContext = await page.context().browser()!.newContext({ baseURL: BASE_URL });
    const memberPage = await memberContext.newPage();

    await memberPage.goto('/signup');

    // Check if signup page is accessible
    if (memberPage.url().includes('/signup')) {
        await memberPage.getByLabel('Full Name').fill(name);
        await memberPage.getByLabel('Email address').fill(email);
        await memberPage.getByLabel('Password', { exact: true }).fill(password);
        await memberPage.getByLabel('Confirm Password').fill(password);
        await memberPage.getByRole('button', { name: /sign up|create account/i }).click();

        // Member will be pending - need admin to approve
        await memberPage.waitForTimeout(1000);
    }

    await memberPage.close();
    await memberContext.close();

    // As admin, approve the member (if needed)
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Find the row with member email and click Manage
    const memberRow = page.locator('tr', { has: page.getByText(email, { exact: true }) });
    await expect(memberRow).toBeVisible();
    await memberRow.getByRole('link', { name: /manage/i }).click();

    // Wait for user detail page to fully render
    await expect(page.getByRole('heading', { name: /status actions/i })).toBeVisible();

    // Click approve button if user is pending (button only exists for pending users)
    const approveButton = page.getByRole('button', { name: /approve user/i });
    if (await approveButton.isVisible()) {
        await approveButton.click();
        // Wait for approval to complete — button disappears when user becomes active
        await expect(approveButton).not.toBeVisible();
    }
    // If user is already active, the approve button won't exist - that's fine

    // Log out admin
    await page.goto('/logout');

    // Now log in as member
    await page.goto('/login');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should be redirected to home
    await expect(page).toHaveURL('/');

    // Save storage state
    await page.context().storageState({ path: AUTH_STORAGE.member });
});

setup.describe.configure({ mode: 'serial' });
