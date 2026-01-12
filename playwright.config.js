/**
 * Playwright Test Configuration
 * Tower Defense Multiplayer Testing
 */

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',

    // Test timeout
    timeout: 60000, // 1 minute default

    // Parallel execution
    fullyParallel: false, // Run sequentially for multiplayer tests
    workers: 1,

    // Retries
    retries: process.env.CI ? 2 : 0,

    // Reporter
    reporter: [
        ['html', { outputFolder: 'playwright-report' }],
        ['list'],
        ['json', { outputFile: 'test-results.json' }]
    ],

    // Test options
    use: {
        // Base URL
        baseURL: 'http://localhost:8080',

        // Browser options
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',

        // Timeouts
        actionTimeout: 10000,
        navigationTimeout: 30000,

        // Viewport
        viewport: { width: 1920, height: 1080 },

        // Other options
        ignoreHTTPSErrors: true,
        bypassCSP: false,
    },

    // Projects for different browsers
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },

        // Uncomment to test on other browsers
        // {
        //     name: 'firefox',
        //     use: { ...devices['Desktop Firefox'] },
        // },
        // {
        //     name: 'webkit',
        //     use: { ...devices['Desktop Safari'] },
        // },

        // Mobile testing
        // {
        //     name: 'mobile-chrome',
        //     use: { ...devices['Pixel 5'] },
        // },
        // {
        //     name: 'mobile-safari',
        //     use: { ...devices['iPhone 12'] },
        // },
    ],

    // Web server (optional - if you want Playwright to start the server)
    // webServer: {
    //     command: 'npm run start',
    //     port: 8080,
    //     timeout: 120000,
    //     reuseExistingServer: !process.env.CI,
    // },
});
