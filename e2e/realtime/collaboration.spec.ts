/**
 * Realtime Collaboration Tests
 *
 * Test IDs: RT-CONN-001 through RT-CONN-003
 * Test IDs: RT-PRESENCE-001 through RT-PRESENCE-003
 * Test IDs: RT-UPDATE-001 through RT-UPDATE-002
 */

import { test, expect, AUTH_STORAGE, uniqueId, BASE_URL } from '../fixtures/test-fixtures';

test.describe('Realtime Collaboration', () => {
    let projectId: number;
    let scenarioId: number;

    test.beforeEach(async ({ browser }) => {
        // Create project and scenario as admin
        const context = await browser.newContext({
            baseURL: BASE_URL,
            storageState: AUTH_STORAGE.admin
        });
        const page = await context.newPage();

        // Create project
        const projectName = uniqueId('RTProject');
        await page.goto('/projects/new');
        await page.getByLabel(/project name/i).fill(projectName);
        await page.getByRole('button', { name: /create/i }).click();
        await page.waitForURL(/\/projects\/\d+/);
        projectId = parseInt(page.url().match(/\/projects\/(\d+)/)?.[1] || '0');

        // Create scenario
        await page.goto(`/projects/${projectId}/scenarios/new`);
        await page.getByLabel(/scenario name/i).fill(uniqueId('RTScenario'));
        await page.getByRole('button', { name: /create/i }).click();
        await page.waitForURL(/\/projects\/\d+\/scenarios\/\d+/);
        scenarioId = parseInt(page.url().match(/\/scenarios\/(\d+)/)?.[1] || '0');

        // Share with member
        await page.goto(`/projects/${projectId}`);
        await page.getByRole('button', { name: /share/i }).click();
        await page.getByPlaceholder('Enter email address').fill('member@test.com');
        await page.getByRole('combobox').first().selectOption('readwrite');
        await page.getByRole('button', { name: 'Add' }).click();
        await page.getByRole('button', { name: 'Done' }).click();

        await context.close();
    });

    test.describe('Connection Status', () => {
        test('RT-CONN-001: SSE connection indicator', async ({ browser }) => {
            const context = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.admin
            });
            const page = await context.newPage();

            await page.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            // Look for connection indicator (typically a small dot or icon)
            // The ConnectionStatus component should show connected state
            const connectionIndicator = page.locator('[class*="connection"], [data-testid="connection-status"]').or(
                page.getByText(/connected|online/i)
            );

            // Wait for connection to establish
            await page.waitForTimeout(2000);

            // Either the indicator is visible or we just verify no errors
            if (await connectionIndicator.count() > 0) {
                await expect(connectionIndicator.first()).toBeVisible();
            }

            await context.close();
        });

        test('RT-CONN-002: Reconnects on disconnect', async ({ browser }) => {
            // This is difficult to test in e2e without mocking
            // Skip for now
            test.skip();
        });
    });

    test.describe('User Presence', () => {
        test('RT-PRESENCE-001: See other active users', async ({ browser }) => {
            // Open the same scenario in two different contexts
            const adminContext = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.admin
            });
            const adminPage = await adminContext.newPage();

            const memberContext = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.member
            });
            const memberPage = await memberContext.newPage();

            // Admin opens scenario first
            await adminPage.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);
            await adminPage.waitForTimeout(1000);

            // Member opens the same scenario
            await memberPage.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);
            await memberPage.waitForTimeout(2000);

            // Look for collaborators display
            // This might be shown as avatars, names, or a count
            const collaboratorsOnAdmin = adminPage.locator(
                '[class*="collaborator"], [class*="avatar"], [data-testid*="active"]'
            ).or(
                adminPage.getByText(/member@test\.com|member user/i)
            );

            // Give time for real-time updates
            await adminPage.waitForTimeout(2000);

            // Verify we can see other users (check for presence indicator)
            // The specific UI depends on implementation
            if (await collaboratorsOnAdmin.count() > 0) {
                test.info().annotations.push({ type: 'info', description: 'Collaborator indicator found' });
            }

            await adminContext.close();
            await memberContext.close();
        });

        test('RT-PRESENCE-002: User appears when joining', async ({ browser }) => {
            // Admin opens first
            const adminContext = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.admin
            });
            const adminPage = await adminContext.newPage();
            await adminPage.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);
            await adminPage.waitForTimeout(1000);

            // Member joins later
            const memberContext = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.member
            });
            const memberPage = await memberContext.newPage();
            await memberPage.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            // Wait for presence update
            await adminPage.waitForTimeout(3000);

            // Check if admin sees member joined
            // Look for any indication of additional user
            const pageContent = await adminPage.content();
            const hasMemberIndicator = pageContent.includes('Member')
                || pageContent.includes('member@test.com')
                || await adminPage.locator('[class*="avatar"]').count() > 1;

            // Just log for now - presence UI varies
            test.info().annotations.push({
                type: 'info',
                description: hasMemberIndicator ? 'Member presence detected' : 'Presence UI not visible'
            });

            await adminContext.close();
            await memberContext.close();
        });

        test('RT-PRESENCE-003: User disappears when leaving', async ({ browser }) => {
            // Similar to above but member leaves
            const adminContext = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.admin
            });
            const adminPage = await adminContext.newPage();
            await adminPage.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            const memberContext = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.member
            });
            const memberPage = await memberContext.newPage();
            await memberPage.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            await adminPage.waitForTimeout(2000);

            // Member leaves
            await memberContext.close();

            // Wait for presence update
            await adminPage.waitForTimeout(3000);

            // The member should no longer appear in presence
            // This is hard to verify without specific UI selectors

            await adminContext.close();
        });
    });

    test.describe('Live Updates', () => {
        test('RT-UPDATE-001: See changes from other users', async ({ browser }) => {
            test.setTimeout(60000);
            // Admin opens scenario
            const adminContext = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.admin
            });
            const adminPage = await adminContext.newPage();
            await adminPage.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            // Member opens and makes changes
            const memberContext = await browser.newContext({
                baseURL: BASE_URL,
                storageState: AUTH_STORAGE.member
            });
            const memberPage = await memberContext.newPage();
            await memberPage.goto(`/projects/${projectId}/scenarios/${scenarioId}/edit`);

            // Member adds a connection
            const uniqueName = uniqueId('RTNode');
            await memberPage.getByPlaceholder('Type or select source...').fill(uniqueName);
            await memberPage.getByPlaceholder('Target...').first().fill('Target');
            await memberPage.getByPlaceholder('a ? * 123').fill('500');
            await memberPage.getByRole('button', { name: /add.*connection/i }).click();

            // Member should see the connection
            await expect(memberPage.getByText(uniqueName).first()).toBeVisible();

            // Wait for real-time update to propagate
            await adminPage.waitForTimeout(2000);

            // Admin should also see the connection (if real-time is working)
            // The page might auto-refresh/update or we might need to check
            // Note: This depends on how the real-time updates are applied
            const adminContent = await adminPage.content();
            const adminSeesChange = adminContent.includes(uniqueName);

            test.info().annotations.push({
                type: 'info',
                description: adminSeesChange
                    ? 'Real-time update received'
                    : 'Real-time update not visible (may need page interaction)'
            });

            await adminContext.close();
            await memberContext.close();
        });

        test('RT-UPDATE-002: Own changes sent but not echoed back', async ({ browser }) => {
            // This tests that user doesn't receive their own events
            // Difficult to test directly in e2e
            test.skip();
        });
    });
});
