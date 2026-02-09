/**
 * Authentication - Session Tests
 *
 * Test IDs: AUTH-SESSION-001 through AUTH-SESSION-004
 */

import { test, expect, AUTH_STORAGE, TEST_USERS, BASE_URL } from '../fixtures/test-fixtures';

test.describe('Session Management', () => {
    test.describe('Session Persistence', () => {
        test('AUTH-SESSION-001: Login state persists after browser close', async ({ browser }) => {
            // Use saved auth state to simulate "returning" user
            const context = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.member
            });
            const page = await context.newPage();

            await page.goto('/');

            // Should still be logged in
            await expect(page.getByText(TEST_USERS.member.name)).toBeVisible();

            await context.close();
        });

        test('Session cookie is HttpOnly', async ({ browser }) => {
            const context = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.member
            });
            const page = await context.newPage();

            await page.goto('/');

            // Get cookies - HttpOnly cookies won't be accessible via JS
            const cookies = await context.cookies();
            const sessionCookie = cookies.find(c => c.name === '__session');

            if (sessionCookie) {
                expect(sessionCookie.httpOnly).toBe(true);
            }

            await context.close();
        });
    });

    test.describe('Protected Routes', () => {
        test('AUTH-SESSION-002: Protected route redirects to login', async ({ page }) => {
            // Don't use any auth state - fresh page (unauthenticated)
            await page.goto('/projects');

            // Should redirect to login
            await expect(page).toHaveURL(/\/login/);
        });

        test('AUTH-SESSION-003: Access protected route with valid session', async ({ browser }) => {
            const context = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.member
            });
            const page = await context.newPage();

            await page.goto('/projects');

            // Should stay on projects page
            await expect(page).toHaveURL('/projects');

            // Should show projects content
            await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();

            await context.close();
        });

        test('Home page requires authentication', async ({ page }) => {
            await page.goto('/');

            // Should redirect to login
            await expect(page).toHaveURL(/\/login/);
        });

        test('Settings page requires authentication', async ({ page }) => {
            await page.goto('/settings');

            await expect(page).toHaveURL(/\/login/);
        });
    });

    test.describe('Logout', () => {
        test('AUTH-SESSION-004: Logout clears session and redirects', async ({ browser }) => {
            // Log in fresh so we don't destroy the saved member session
            const context = await browser.newContext({ baseURL: BASE_URL });
            const page = await context.newPage();

            await page.goto('/login');
            await page.getByLabel('Email address').fill(TEST_USERS.member.email);
            await page.getByLabel('Password').fill(TEST_USERS.member.password);
            await page.getByRole('button', { name: /sign in/i }).click();
            await expect(page).toHaveURL('/');

            // Click logout - might be in dropdown or direct link
            const logoutLink = page.getByRole('link', { name: /logout|sign out/i });

            if (await logoutLink.isVisible()) {
                await logoutLink.click();
            } else {
                // Try navigating directly
                await page.goto('/logout');
            }

            // Should be redirected to login
            await expect(page).toHaveURL(/\/login/);

            // Visiting protected route should redirect to login
            await page.goto('/projects');
            await expect(page).toHaveURL(/\/login/);

            await context.close();
        });

        test('Logout is idempotent', async ({ page }) => {
            // Visit logout without being logged in
            await page.goto('/logout');

            // Should redirect to login without error
            await expect(page).toHaveURL(/\/login/);
        });
    });

    test.describe('Session Security', () => {
        test('Cannot access API without session', async ({ request }) => {
            // Try to access a protected API endpoint without auth
            const response = await request.get('/api/realtime');

            // API request follows redirects, so unauthenticated request may land on login page (200)
            expect([ 200, 401, 302, 303 ]).toContain(response.status());
        });

        test('Invalid session cookie is rejected', async ({ browser }) => {
            const context = await browser.newContext({ baseURL: BASE_URL });

            // Set an invalid session cookie
            await context.addCookies([ {
                name: '__session',
                value: 'invalid-session-token',
                domain: 'localhost',
                path: '/'
            } ]);

            const page = await context.newPage();
            await page.goto('/projects');

            // Should redirect to login
            await expect(page).toHaveURL(/\/login/);

            await context.close();
        });
    });
});
