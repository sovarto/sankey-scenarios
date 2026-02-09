import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Sankey Scenarios E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    // Global setup - reset test database before each run
    globalSetup: './e2e/global-setup.ts',

    // Test directory
    testDir: './e2e',

    // Run tests in parallel
    fullyParallel: true,

    // Fail the build on CI if you accidentally left test.only in the source code
    forbidOnly: !!process.env.CI,

    // Retry on CI only
    retries: process.env.CI ? 2 : 0,

    // Serial execution — shared DB sessions get corrupted under concurrency
    workers: 10,

    // Reporter configuration
    reporter: [ [ 'html', { open: 'never' } ], [ 'list' ] ],

    // Shared settings for all projects
    use: {
        // Base URL for navigation
        baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',

        // Collect trace when retrying the failed test
        trace: 'on-first-retry',

        // Screenshot on failure
        screenshot: 'only-on-failure',

        // Video on failure
        video: 'on-first-retry'
    },

    // Configure projects for browsers
    projects: [
        // Setup project - runs before all tests to create auth state
        {
            name: 'setup',
            testMatch: /.*\.setup\.ts/
        },

        // Main test project - Chromium
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome']
            },
            dependencies: [ 'setup' ]
        },
        // Optional: Add more browsers for full coverage
        // {
        //     name: 'firefox',
        //     use: { ...devices['Desktop Firefox'] },
        //     dependencies: ['setup'],
        // },
        // {
        //     name: 'webkit',
        //     use: { ...devices['Desktop Safari'] },
        //     dependencies: ['setup'],
        // },
    ],

    // Web server configuration - start the app before running tests
    webServer: {
        command: 'npm run dev:test',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
        stdout: 'pipe',
        stderr: 'pipe'
    },

    // Global timeout for each test
    timeout: 30 * 1000,

    // Expect timeout
    expect: {
        timeout: 5 * 1000
    }
});
