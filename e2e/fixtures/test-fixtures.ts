/**
 * Playwright test fixtures for Sankey Scenarios
 *
 * Provides authenticated pages, test data, and utility functions.
 */

import { test as base, expect, type Page } from '@playwright/test';

/** Base URL for test server - must be passed to every manual newContext() call */
export const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Test user credentials
export const TEST_USERS = {
    admin: {
        email: 'admin@test.com',
        password: 'AdminPass123!',
        name: 'Test Admin'
    },
    member: {
        email: 'member@test.com',
        password: 'MemberPass123!',
        name: 'Test Member'
    },
    pending: {
        email: 'pending@test.com',
        password: 'PendingPass123!',
        name: 'Pending User'
    },
    blocked: {
        email: 'blocked@test.com',
        password: 'BlockedPass123!',
        name: 'Blocked User'
    }
} as const;

export type TestUser = keyof typeof TEST_USERS;

// Storage state paths for authenticated sessions
export const AUTH_STORAGE = {
    admin: 'e2e/.auth/admin.json',
    member: 'e2e/.auth/member.json'
};

/**
 * Extended test fixture with authentication helpers
 */
export const test = base.extend<{
    /** Login as a specific user */
    loginAs: (user: TestUser) => Promise<void>;
    /** Create a new project and return its ID */
    createProject: (name: string, description?: string) => Promise<number>;
    /** Create a new scenario in a project and return its ID */
    createScenario: (projectId: number, name: string) => Promise<number>;
}>({
    // Login helper
    loginAs: async ({ page }, use) => {
        const loginAs = async (user: TestUser) => {
            const { email, password } = TEST_USERS[user];
            await page.goto('/login');
            await page.getByLabel('Email address').fill(email);
            await page.getByLabel('Password').fill(password);
            await page.getByRole('button', { name: 'Sign in' }).click();
            await expect(page).toHaveURL('/');
        };
        await use(loginAs);
    },

    // Project creation helper
    createProject: async ({ page }, use) => {
        const createProject = async (name: string, description?: string): Promise<number> => {
            await page.goto('/projects/new');
            await page.getByLabel(/project name/i).fill(name);
            if (description) {
                await page.getByLabel(/description/i).fill(description);
            }
            await page.getByRole('button', { name: /create/i }).click();

            // Wait for redirect to project page and extract ID
            await page.waitForURL(/\/projects\/\d+/, { timeout: 10000 });
            const url = page.url();
            const match = url.match(/\/projects\/(\d+)/);
            if (!match) {
                throw new Error('Failed to extract project ID');
            }
            return parseInt(match[1], 10);
        };
        await use(createProject);
    },

    // Scenario creation helper
    createScenario: async ({ page }, use) => {
        const createScenario = async (projectId: number, name: string): Promise<number> => {
            await page.goto(`/projects/${projectId}/scenarios/new`);
            await page.getByLabel(/scenario name/i).fill(name);
            await page.getByRole('button', { name: /create/i }).click();

            // Wait for redirect to scenario page and extract ID
            await page.waitForURL(/\/projects\/\d+\/scenarios\/\d+/, { timeout: 10000 });
            const url = page.url();
            const match = url.match(/\/scenarios\/(\d+)/);
            if (!match) {
                throw new Error('Failed to extract scenario ID');
            }
            return parseInt(match[1], 10);
        };
        await use(createScenario);
    }
});

export { expect } from '@playwright/test';

/**
 * Helper to wait for network idle (useful after form submissions)
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000) {
    await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Helper to get form validation error text
 */
export async function getFormError(page: Page): Promise<string | null> {
    const error = page.locator('[class*="error"], [class*="Error"], .text-red-700, .bg-red-50');
    if (await error.isVisible()) {
        return await error.textContent();
    }
    return null;
}

/**
 * Helper to fill connection form (uses NodeCombobox inputs by placeholder)
 */
export async function addConnection(page: Page, source: string, target: string, value: string) {
    await page.getByPlaceholder('Type or select source...').fill(source);
    await page.getByPlaceholder('Target...').first().fill(target);
    // Value input placeholder depends on context: 'a ? * 123' for direct, 'a * 123' for group sub-node
    const valueInput = page.getByPlaceholder('a ? * 123').or(page.getByPlaceholder('a * 123'));
    await valueInput.first().fill(value);
    await page.getByRole('button', { name: /add.*connection/i }).click();
}

/**
 * Helper to check if Sankey diagram is rendered
 */
export async function isSankeyVisible(page: Page): Promise<boolean> {
    const svg = page.locator('svg').first();
    return await svg.isVisible();
}

/**
 * Generate unique test identifiers
 */
export function uniqueId(prefix = 'test'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
