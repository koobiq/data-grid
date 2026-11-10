import { defineConfig, devices, ViewportSize } from '@playwright/test';

const isCI = !!process.env.CI;
const viewport: ViewportSize = { width: 1200, height: 720 };
const baseURL = process.env.BASE_URL ?? 'http://localhost:4200';
const webServerCommand = process.env.WEB_SERVER_COMMAND ?? 'yarn run dev:theme';

/**
 * Reads `WORKERS`, a number of workers or a share of the CPUs such as `50%`. Only a whole number is converted: the
 * config accepts a count as a number, and anything else is left for Playwright to accept as a share or reject.
 */
const parseWorkers = (value: string | undefined): number | string | undefined => {
    if (!value) return undefined;

    return /^\d+$/.test(value) ? Number(value) : value;
};

/** @see https://playwright.dev/docs/test-configuration */
export default defineConfig({
    testDir: __dirname,
    testMatch: ['**/*.playwright-spec.ts'],
    tsconfig: 'tsconfig.playwright-spec.json',
    fullyParallel: true,
    timeout: 15 * 1000,
    forbidOnly: isCI,
    retries: isCI ? 0 : undefined,
    // The Dockerfile sets `CI` for local runs too, and all the CPUs of a machine bigger than the CI runner start more
    // browsers than the Docker VM can serve: tests then fail on timeouts, differently on every run. Pass `WORKERS=4`.
    workers: parseWorkers(process.env.WORKERS) ?? (isCI ? '100%' : undefined),
    reporter: [
        ['list', { printSteps: true }],
        ['html', { open: 'never' }]
    ],
    projects: [
        {
            name: 'Chrome',
            use: {
                ...devices['Desktop Chrome HiDPI'],
                viewport
            }
        }
    ],
    snapshotPathTemplate: '{testFileDir}/__snapshots__/{arg}{ext}',
    expect: {
        toHaveScreenshot: {
            pathTemplate: '{testFileDir}/__screenshots__/{arg}{ext}',
            threshold: 0,
            scale: 'device',
            animations: 'disabled'
        },
        timeout: 2000
    },
    webServer: {
        command: webServerCommand,
        url: baseURL,
        timeout: 10 * 60 * 1000,
        reuseExistingServer: !isCI
    },
    use: {
        baseURL,
        trace: 'on-first-retry',
        contextOptions: {
            deviceScaleFactor: 2,
            reducedMotion: 'reduce',
            viewport
        }
    }
});
