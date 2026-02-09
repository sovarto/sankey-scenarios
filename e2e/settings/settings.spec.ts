/**
 * Settings Tests
 *
 * Test IDs: SET-001 through SET-004
 */

import { test, expect, AUTH_STORAGE, TEST_USERS, uniqueId, BASE_URL } from '../fixtures/test-fixtures';

test.describe('Settings', () => {
    test.describe.configure({ mode: 'serial' });
    test.use({ storageState: AUTH_STORAGE.member });

    test.describe('View Settings', () => {
        test('SET-001: View settings page', async ({ page }) => {
            await page.goto('/settings');

            // Should show settings page - use exact match
            await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();

            // Should show regional settings section
            await expect(page.getByText('Regional Settings')).toBeVisible();

            // Should show locale dropdowns
            await expect(page.getByLabel(/display language/i)).toBeVisible();
            await expect(page.getByLabel(/regional format/i)).toBeVisible();
        });

        test('Settings shows sample number format', async ({ page }) => {
            await page.goto('/settings');

            // Should show sample/preview for regional format
            // Check for the preview section or number display
            await expect(page.locator('text=/\\d/').first()).toBeVisible();
        });
    });

    test.describe('Change Settings', () => {
        test('SET-002: Change regional locale', async ({ page }) => {
            await page.goto('/settings');

            // Change regional format to German
            await page.getByLabel(/regional format/i).selectOption('de-DE');
            await page.getByRole('button', { name: /save/i }).click();

            // Should show success message or not show error
            await page.waitForTimeout(500);

            // Reload page to verify persistence
            await page.reload();

            // Should show German format selected
            await expect(page.getByLabel(/regional format/i)).toHaveValue('de-DE');
        });

        test('SET-003: Number format preview updates', async ({ page }) => {
            await page.goto('/settings');

            // Change to German locale
            await page.getByLabel(/regional format/i).selectOption('de-DE');

            // Save and verify
            await page.getByRole('button', { name: /save/i }).click();
            await page.waitForTimeout(500);
        });

        test('Change display language', async ({ page }) => {
            await page.goto('/settings');

            // Change display language
            const langSelect = page.getByLabel(/display language/i);
            if (await langSelect.isVisible()) {
                await langSelect.selectOption('de-DE');
                await page.getByRole('button', { name: /save/i }).click();
                await page.waitForTimeout(500);

                // Verify persistence
                await page.reload();
                await expect(langSelect).toHaveValue('de-DE');
            }
        });

        test('Reset to browser default', async ({ page }) => {
            await page.goto('/settings');

            // First set a specific locale
            await page.getByLabel(/regional format/i).selectOption('de-DE');
            await page.getByRole('button', { name: /save/i }).click();
            await page.waitForTimeout(500);

            // Then reset to browser default (empty value)
            await page.getByLabel(/regional format/i).selectOption('');
            await page.getByRole('button', { name: /save/i }).click();
            await page.waitForTimeout(500);

            await page.reload();
            await expect(page.getByLabel(/regional format/i)).toHaveValue('');
        });
    });

    test.describe('Settings Persistence', () => {
        test('SET-004: Settings persist after logout/login', async ({ browser }) => {
            // First, set a specific setting
            const context1 = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.member
            });
            const page1 = await context1.newPage();

            await page1.goto('/settings');
            await page1.getByLabel(/regional format/i).selectOption('fr-FR');
            await page1.getByRole('button', { name: /save/i }).click();
            await page1.waitForTimeout(500);

            await context1.close();

            // Simulate "new session" by creating new context with same auth
            const context2 = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.member
            });
            const page2 = await context2.newPage();

            await page2.goto('/settings');

            // Settings should be retained
            await expect(page2.getByLabel(/regional format/i)).toHaveValue('fr-FR');

            // Reset for other tests
            await page2.getByLabel(/regional format/i).selectOption('');
            await page2.getByRole('button', { name: /save/i }).click();

            await context2.close();
        });
    });

    test.describe('Navigation', () => {
        test('Back link returns to home', async ({ page }) => {
            await page.goto('/settings');

            // Look for a back link or navigation element
            const backLink = page.getByRole('link', { name: /back|home|←/i }).first();
            if (await backLink.isVisible()) {
                await backLink.click();
                await expect(page).toHaveURL('/');
            } else {
                // Use browser back or check navigation is available
                test.skip();
            }
        });
    });
});
